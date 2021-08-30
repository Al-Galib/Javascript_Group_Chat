const express = require("express");
const app = express();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer);
const SocketIOFile = require("socket.io-file");
const path = require("path");
const uuid = require("uuid");
const fs = require("fs");

app.use(express.static(__dirname + "/webroot"));
////////////Socket
//////////////////////////////
const rooms = require("./database/db.json");
var users = [];
io.on("connection", (socket) => {
     var uploader = new SocketIOFile(socket, {
          uploadDir: "webroot\\uploads", // simple directory
          /*accepts: [
               "audio/mpeg",
               "video/x-msvideo",
               "video/webm",
               "audio/mp3",
               "image/jpeg",
               "image/png",
               "image/gif",
               "application/pdf",
               "text/plain",
               "application/zip",
               "application/x-zip-compressed",
          ], // chrome and some of browsers checking mp3 as 'audio/mp3', not 'audio/mpeg'*/
          maxFileSize: 4194304, // 4 MB. default is undefined(no limit)
          chunkSize: 10240, // default is 10240(1KB)
          transmissionDelay: 0, // delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
          overwrite: false,
          rename: function (filename, fileInfo) {
               var file = path.parse(filename);
               var fname = uuid.v4(); // file.name;
               var ext = file.ext;
               return `${fname}${ext}`;
          }, // overwrite file if exists, default is true.
     });
     socket.on("disconnecting", () => {
          var u = users.find((v, i) => v.user == socket.username);

          if (u) {
               socket.leave(u.currentGroup);
               var i = users.findIndex((v, i) => v.user == socket.username);
               users.splice(i, 1);
               io.to(u.currentGroup).emit(
                    "userlist",
                    users
                         .filter((v, i) => v.currentGroup == u.currentGroup)
                         .map((v, i) => v.user)
               );
          }
     });
     socket.on("disconnect", () => {
          //console.log(users);
          console.log("disconnected");
     });
     socket.on("signin", (uname) => {
          socket.username = uname;
          socket.emit("init", { user: uname, rooms: rooms });
     });
     socket.on("join", (g) => {
          var u = users.find((v, i) => v.user == socket.username);
          // console.log(u);
          if (u) {
               //console.log("there");
               var oldG = u.currentGroup;
               socket.leave(u.currentGroup);
               u.currentGroup = g;
               socket.join(g);
               io.to(oldG).emit(
                    "userlist",
                    users
                         .filter((v, i) => v.currentGroup == oldG)
                         .map((v, i) => v.user)
               );
               socket.emit("leaveSuccess", {
                    from: "",
                    msg: `${socket.username} left the group ${oldG}`,
               });
          } else {
               //console.log("note there");
               socket.join(g);
               users.push({ user: socket.username, currentGroup: g });
               socket.emit("joinSuccess", {
                    from: "",
                    g: g,
                    msg: `${socket.username} joined the group ${g}`,
               });
          }
          io.to(g).emit(
               "userlist",
               users.filter((v, i) => v.currentGroup == g).map((v, i) => v.user)
          );

          //console.log(users);
     });
     socket.on("create", (g) => {
          
          rooms.push(g);
          //console.log(rooms);
          fs.writeFile(
               "./database/db.json",
               JSON.stringify(rooms),
               "utf8",
               (err) => {
                    if (err) throw err;
                    io.emit("glist", rooms);
               }
          );
          

          //console.log(users);
     });
     socket.on("send", (m) => {
          console.log(m);
          var u = users.find((v, i) => v.user == socket.username);
          if (u) {
               io.to(u.currentGroup).emit("message", {
                    from: socket.username,
                    msg: m,
               });
          }
     });
     /*
      * Uploader events
      */
     uploader.on("start", (fileInfo) => {
          console.log("Start uploading");
          console.log(fileInfo);
     });
     uploader.on("stream", (fileInfo) => {
          console.log(`${fileInfo.wrote} / ${fileInfo.size} byte(s)`);
     });
     uploader.on("complete", (fileInfo) => {
          console.log("Upload Complete.");
          console.log(fileInfo);
          var u = users.find((v, i) => v.user == socket.username);
          if(u) {
              io.to(u.currentGroup).emit( 
                   'uploaded', 
              {
                   from:socket.username, 
                    msg: `File uploaded: <a target='_blank' href='./uploads/${fileInfo.name}'><i class="fa fa-arrow-circle-down" aria-hidden="true"></i><a>`}
               );
          }
     });
     uploader.on("error", (err) => {
          console.log("Error!", err);
     });
     uploader.on("abort", (fileInfo) => {
          console.log("Aborted: ", fileInfo);
     });
});
httpServer.listen(9000, () => {
     console.log("Server running at port:9000...");
});
