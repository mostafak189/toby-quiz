const express = require("express")
const http = require("http")
const {Server} = require("socket.io")
const sqlite3 = require("sqlite3").verbose()
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const db = new sqlite3.Database("quiz.db")

db.serialize(() => {

  db.run(`
  CREATE TABLE IF NOT EXISTS eras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )
  `)

  db.run(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    era_id INTEGER,
    text TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct TEXT
  )
  `)

})

app.use(express.json())
app.use(express.static(path.join(__dirname,"public")))

let games = {}

function generatePin(){
 return Math.floor(100000 + Math.random()*900000).toString()
}

app.get("/eras",(req,res)=>{
 db.all("SELECT * FROM eras",(err,rows)=>{
  res.json(rows)
 })
})

app.post("/eras",(req,res)=>{
 const {name} = req.body
 db.run("INSERT INTO eras(name) VALUES(?)",[name],function(){
  res.json({id:this.lastID})
 })
})

app.delete("/eras/:id",(req,res)=>{
 const id=req.params.id
 db.run("DELETE FROM questions WHERE era_id=?",[id])
 db.run("DELETE FROM eras WHERE id=?",[id],()=>{
  res.json({success:true})
 })
})

app.get("/questions/:era",(req,res)=>{
 const era=req.params.era
 if(era==0){
  db.all("SELECT * FROM questions",(e,r)=>res.json(r))
 }else{
  db.all("SELECT * FROM questions WHERE era_id=?",[era],(e,r)=>res.json(r))
 }
})

app.post("/questions",(req,res)=>{
 const q=req.body
 db.run(
`INSERT INTO questions(era_id,text,option_a,option_b,option_c,option_d,correct)
VALUES(?,?,?,?,?,?,?)`,
[q.era_id,q.text,q.option_a,q.option_b,q.option_c,q.option_d,q.correct],
function(){
 res.json({id:this.lastID})
})
})

app.put("/questions/:id",(req,res)=>{
 const id=req.params.id
 const q=req.body
 db.run(
`UPDATE questions SET
era_id=?,text=?,option_a=?,option_b=?,option_c=?,option_d=?,correct=?
WHERE id=?`,
[q.era_id,q.text,q.option_a,q.option_b,q.option_c,q.option_d,q.correct,id],
()=>res.json({success:true})
)
})

app.delete("/questions/:id",(req,res)=>{
 db.run("DELETE FROM questions WHERE id=?",[req.params.id],()=>{
  res.json({success:true})
 })
})

io.on("connection",(socket)=>{

socket.on("host-game",({pin})=>{
 games[pin]={players:[],scores:{},questions:[],index:0}
})

socket.on("player-join",({pin,name,avatar})=>{
 if(!games[pin])return
 games[pin].players.push({name,avatar})
 games[pin].scores[name]=0
 io.emit("player-joined",name)
})

socket.on("start-game",({pin})=>{
 if(!games[pin])return
 db.all("SELECT * FROM questions",(e,rows)=>{
  games[pin].questions=rows
  games[pin].index=0
  io.emit("new-question",rows[0])
 })
})

socket.on("submit-answer",({pin,player,answer})=>{
 const game=games[pin]
 if(!game)return

 const q=game.questions[game.index]
 if(q.correct===answer){
  game.scores[player]+=1
 }

})

})

const PORT = process.env.PORT || 3000

server.listen(PORT,()=>{
 console.log("Server running on",PORT)
})
