const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');
const { fileURLToPath } = require('url');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const auth = require('./auth.js');
const collection = require('./mongodb.js');

dotenv.config();

const saltRounds = 10;
const { SESSION_SECRET } = process.env;

var globalName;
var globalemail;

// Define __dirname for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Initialize express and http server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', 'views');

// Serve static files

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.get("/", auth.isLogout, (req, res) => {
    return res.render("main"); // Updated to match EJS template name
});
// app.get("/main",auth.isLogin,(req, res) => {
//     return res.render("main");
// });
app.get("/login", auth.isLogout, (req, res) => {
    return res.render("login");
});
app.get("/logout",auth.isLogin,(req,res)=>{
    try {
        req.session.destroy(); //the login user's session ends
        return res.redirect("/");
    } catch (error) {
        console.log(error.message);

    }
    return res.render("main"); // Updated to match EJS template name

})
app.get('/home', auth.isLogin, (req, res) => {
    return res.render('iss-location');
});

app.get("/register", auth.isLogout, (req, res) => {
    return res.render("register");
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        console.log('Received data:', { name, email, password });

        if (!name || !email || !password) {
            return res.render('login', { message: "Name, email, and password are required." });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log("The hashed pass:", hashedPassword);

        const newUser = new collection({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();
        return res.render("login", { message: "Registration successful. Please log in." });
    } catch (error) {
        console.error("Error during registration:", error);
        return res.render('login', { message: 'Registration failed' });
    }
});
// app.post("/register", async (req, res) => {
//     try {
//         const { name, email, password } = req.body;
//         console.log('Received data:', { name, email, password }); // Debug line
//         console.log("Registered password:", password);

//         if (!name || !email || !password) {
//             return res.status(400).send("Name, email, and password are required.");
//         }

//         const hashedPassword = await bcrypt.hash(password, saltRounds);
//         console.log("The hashed pass:", hashedPassword);

//         const newUser = new collection({
//             name,
//             email,
//             password: hashedPassword
//         });

//         await newUser.save();
//         return res.render("login", { message: "Registration successful. Please log in." });
//     } catch (error) {
//         console.error("Error during registration:", error);
//         return res.render('login', { message: 'Registration failed' });
//     }
// });
// app.post('/register', async (req, res) => {
//     try {
//         const { name, email, password } = req.body;
//         console.log('Received data:', { name, email, password }); // Debug line

//         if (!name || !email || !password) {
//             return res.status(400).send('Name, email, and password are required.');
//         }

//         const hashedPassword = await bcrypt.hash(password, saltRounds);
//         console.log('Hashed password:', hashedPassword); // Debug line

//         // Save user to the database
//         // Your code to save user...

//         res.render('login', { message: 'Registration successful. Please log in.' });
//     } catch (error) {
//         console.error('Error during registration:', error);
//         res.render('login', { message: 'Registration failed' });
//     }
// });

app.post("/api/login", async (req, res) => {
    try {
        const user = await collection.findOne({ email: req.body.email });

        if (!user) {
            return res.render("login", { error: "Invalid username or password." });
        }

        console.log("Entered password:", req.body.password);
        console.log("Stored hashed password:", user.password);

        const isPasswordMatch = await bcrypt.compare(req.body.password, user.password);

        console.log("Password match result:", isPasswordMatch);

      
            if (isPasswordMatch && user) {
                req.session.user = {
                    name: user.name,
                    email: user.email
                };

                globalName = req.body.name;
                globalemail = req.body.email;
                res.redirect('/home');
            }
        } 
     catch (error) {
        console.error("Error during login:", error);
        return res.status(500).send("An error occurred during login.");
    }
});


// const fetchAndEmitISSData = async () => {
//     try {
//         const response = await axios.get('https://api.wheretheiss.at/v1/satellites/25544');
//         const data = response.data;
//         globalData = data;
//         console.log(data);
//         io.emit('issData', { data });
//     } catch (error) {
//         console.log('Error fetching the ISS data:', error);
//     }
// };

// io.on('connection', (socket) => {
//     console.log('A user connected');

//     fetchAndEmitISSData();

//     const intervalId = setInterval(fetchAndEmitISSData, 5000);

//     socket.on('disconnect', () => {
//         console.log('A user disconnected');
//         clearInterval(intervalId);
//     });
// });
let cachedData = null;
const CACHE_INTERVAL = 2000; // 2 seconds

const fetchAndEmitISSData = async () => {
    try {
        const response = await axios.get('https://api.wheretheiss.at/v1/satellites/25544');
        cachedData = response.data; // Update cached data
        console.log('ISS Data fetched:', cachedData);
        io.emit('issData', cachedData); // Emit the cached data
    } catch (error) {
        console.log('Error fetching the ISS data:', error);
    }
};

// Initial data fetch
fetchAndEmitISSData();

// Set up periodic fetching of data
setInterval(fetchAndEmitISSData, CACHE_INTERVAL);

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send cached data to new connections
    if (cachedData) {
        socket.emit('issData', cachedData);
    }

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const port = 4568;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
