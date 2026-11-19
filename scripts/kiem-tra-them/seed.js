const B='http://127.0.0.1:3002';let ck='';
const H=()=>({'Content-Type':'application/json','X-Requested-With':'fetch',Origin:B,Cookie:ck});
(async()=>{
 let r=await fetch(B+'/api/setup',{method:'POST',headers:H(),body:JSON.stringify({ten_cong_ty:'MYMONEY',company_name:'MYMONEY',username:'admin',password:process.env.BKS_PASS,ho_ten:'Admin',full_name:'Admin'})});console.log('setup',r.status,(await r.text()).slice(0,150));
 r=await fetch(B+'/api/auth/login',{method:'POST',headers:H(),body:JSON.stringify({username:'admin',password:process.env.BKS_PASS})});ck=(r.headers.getSetCookie?r.headers.getSetCookie():[r.headers.get('set-cookie')]).map(c=>c.split(';')[0]).join('; ');console.log('login',r.status);
 r=await fetch(B+'/api/demo',{method:'POST',headers:H(),body:'{}'});console.log('demo',r.status,(await r.text()).slice(0,100));
})();
