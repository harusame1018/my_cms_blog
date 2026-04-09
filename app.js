const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const marked = require("marked")
const fs = require("fs")
const path = require("path");
const fm = require("front-matter");
const gm = require("gray-matter");
const multer = require("multer");
require("date-utils");
require("dotenv").config();

const admin_token = process.env.ADMIN_TOKEN;
const storage = multer.diskStorage({
    destination:function (req,file,cb) {
        cb(null,path.join(__dirname,"/views/public/uploads/"))
    },
    filename:function(req,file,cb) {
        cb(null,file.originalname)
    }
})
const upload = multer({storage: storage});

const app = express();
const port = 3000;

app.get("/",(req,res) => {
    res.redirect("/news");
})

app.use(express.static(path.join(__dirname,"/views")));

app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.set("view engine","ejs");
app.set("views", __dirname + "/views");

app.get("/test_page",(req,res) => {
    res.render("public/main");
})

app.get("/news",(req,res) => {
    const files = fs.readdirSync(path.join(__dirname + "/posts"))
    const posts = files.map(file => {
        const content = fs.readFileSync(path.join(__dirname + "/posts/" + file,),"utf-8");
        const data = gm(content);
        return {
            slug:file.replace(".md",""),
            title:data.data.title,
            headline:data.data.headline,
            date:data.data.date
        };
    })
    res.render("public/news",{posts})
})

app.get("/news/:slug",(req,res) => {
    const slug_param = req.params.slug;
    const news_file = fs.readFileSync(__dirname + "/posts/" + slug_param + ".md","utf-8");
    const content = fm(news_file);
    const news_content = marked.parse(content.body);
    const news_title = content.attributes.title;
    const news_date = content.attributes.date;
    res.render("public/slug", { title: news_title,body: news_content,date: news_date });
})

app.post("/admin/post",upload.single("file"),(req,res) => {
    if (req.cookies.admin !== admin_token || !req.cookies.admin) {
        return res.send("ログインしてください");
        
    }
    const title = req.body.title;
    const body = req.body.body;
    const headline = req.body.headline;
    
    const dt = new Date();
    const today = dt.toFormat("YYYY年MM月DD日HH24時MI分")

    const matter_data = {
        title: title,
        headline: headline,
        date: today
    };

    
    const filename = __dirname + "/posts/" + dt.toFormat("YYYY-MM-DD-HH24-MI") + ".md";

    const file_content = gm.stringify(body,matter_data);

    fs.writeFile(filename,file_content,"utf-8",(err) => {
        if(err) {
            console.error("書き込みエラー:",err);
            return;
        }
    });
    res.redirect("/news")
})

app.post("/admin/delete",(req,res) => {
    if (req.cookies.admin !== admin_token || !req.cookies.admin) {
        return res.send("ログインしてください")
    }
    const request_body = req.body;
    const delete_post_name = request_body.slug;
    const delete_file_pass = path.join(__dirname,"posts",delete_post_name + ".md");
    fs.unlink(delete_file_pass,(err) => {
        if(err) {
            console.error("削除失敗",err);
            return res.send("削除に失敗しました");
        }
        return res.send("削除に成功しました");
    });
})

app.get("/admin",(req,res) => {
    if (req.cookies.admin !== admin_token || !req.cookies.admin) {
        res.sendFile(__dirname + "/views/admin/login.html");
    }
    else {
        res.redirect("/admin_panel")
    }
})

app.get("/admin/delete_page",(req,res) => {
    if (req.cookies.admin !== admin_token || !req.cookies.admin) {
        return res.send("ログインしてください");
    }
    const files = fs.readdirSync(path.join(__dirname + "/posts"))
    const posts = files.map(file => {
        const content = fs.readFileSync(path.join(__dirname + "/posts/" + file,),"utf-8");
        const data = gm(content);
        return {
            slug:file.replace(".md",""),
            title:data.data.title,
            headline:data.data.headline
        };
    })
    res.render("admin/delete", {posts})
})

app.get("/admin/edit/:id",(req,res) => {
    if (req.cookies.admin !== admin_token || !req.cookies.admin) {
        return res.send("ログインしてください");
    }
    const post = getPost(req.params.id);
    res.render("admin/edit", { post });
})

app.post("/admin/edit/:id",(req,res) => {
    if (req.cookies.admin !== admin_token || !req.cookies.admin) {
        return res.send("ログインしてください");
        
    }
    const title = req.body.title;
    const body = req.body.body;
    const headline = req.body.headline;
    const matter_data = {
        title: title,
        headline: headline
    };
    const file_content = gm.stringify(body,matter_data);
    fs.writeFile(path.join(__dirname,"posts",req.params.id + ".md"),file_content,"utf-8",(err) => {
        if(err) {
            console.error("書き込みエラー:",err);
            return;
        }
    });
    res.redirect("/news/" + req.params.id)
})

function getPost(id) {
    const news_file = fs.readFileSync(__dirname + "/posts/" + id + ".md","utf-8");
    const content = fm(news_file);
    const news_title = content.attributes.title;
    return {
        body:content.body,
        title:news_title
    };
}

app.post("/login",(req,res) => {
    let request_body = req.body;
    let password_input = request_body.password;
    let username_input = request_body.username;
    let admin_name = process.env.ADMIN_NAME;
    let admin_pass = process.env.ADMIN_PASS;
    if (password_input == admin_pass && username_input == admin_name) {
        console.log("correct login");
        console.log("token:", admin_token);
        res.cookie("admin",admin_token,{httpOnly: true,secure: true,sameSite: "lax"});
        res.send("OK")
    }
    else {
        res.send("error")
    }
})

app.get("/admin/post",(req,res) => {
    res.sendFile(__dirname + "/views/admin/post.html");
})

app.get("/admin_panel",(req,res) => {
    if (req.cookies.admin !== admin_token || !req.cookies.admin) {
        return res.send("ログインしてください");
    }
    const files = fs.readdirSync(path.join(__dirname + "/posts"))
    const posts = files.map(file => {
        const content = fs.readFileSync(path.join(__dirname + "/posts/" + file,),"utf-8");
        const data = gm(content);
        return {
            slug:file.replace(".md",""),
            title:data.data.title,
            headline:data.data.headline
        };
    })
    res.render("admin/admin", {posts});
})
app.listen(port,() => {
    console.log("server is running");
    console.log(require('dotenv').config());
})
