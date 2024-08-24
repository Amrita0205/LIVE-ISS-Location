// you cannot access unless you login and if you logout you cannnot access
// next helps to go to the next routes
const isLogin=async(req,res,next)=>{
    try {
        if(req.session.user){

        }
        else{
            return res.redirect('/');
        }
        next();
    } catch (error) {
        console.log(error.message);
    }
}

const isLogout=async(req,res,next)=>{
    try {
        if(req.session.user){
            return res.redirect('/home');
        }
       
        next();
    } catch (error) {
        console.log(error.message);
    }
    
}

module.exports={
    isLogin,
    isLogout
}