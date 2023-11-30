const { Server } = require("socket.io");
import { prisma } from "../../server/db/client";
import { getAllCampStats, getAllRoutes, getAllGens } from "../../lib/stats";
import { Console } from "console";
import { off } from "process";
import path from "path";

const SocketHandler = (req, res) => {
  if (res.socket.server.io) {
    console.log("Socket is already running");
  } else {
    console.log("Socket is initializing");
    const io = new Server(res.socket.server);
    res.socket.server.io = io;
    var timerStartTime = 0;
    var timerStopTime = 0;

    // if timer is started for 1 minute, will be 60*1000 (milliseconds)
    var timerTotalTime = 0; 
    var timerRunning = false;


    function getTimeRemaining() {
      const now = new Date();
      console.log(timerTotalTime + "  - " + now.getTime() + " - " + timerStartTime);
      return timerTotalTime - (now.getTime() - timerStartTime);
    }

    io.on("connection", async (socket) => {
      console.log(`User connected: ${socket.id}`);

      // client has just connected, get initial stats
      const campStats = await getAllCampStats();
      const routes = await getAllRoutes();
      const gens = await getAllGens();
      // send initial stats to client who connected
      socket.emit("camp_stats", campStats, false);
      socket.emit("routes", routes, false);
      socket.emit("gens", gens, false);

      if (timerRunning) {
        const now = new Date().getTime();
        if (now < timerStopTime) {
          //socket.emit('startTimer', timerStopTime);
          socket.emit('syncClock', now);
        }
        else {
          timerRunning = false;
        }
      }

      socket.on("updateLevelFood", async (data) => {
        try {
          const updateFood = await prisma.RefugeeCamp.update({
            where: { id: 1 },
            data: { foodLevel: 10 },
          });
          io.emit("dataBaseUpdated", updateFood);
          console.log("Update food was send");
        } catch (error) {
          console.error(error);
        }
      });

      socket.on("updateCampStats", async (data, region) => {
        console.log("receieved in back end");
        console.log("data: ");
        console.log(data);
        //const{selectedRegion, food, housing, healthcare,} = data
        await prisma.DeployableRegion.update({
          where: {
            id: parseInt(region),
          },
          data: {
            food: parseInt(data.food),
            healthcare: parseInt(data.healthcare),
            housing: parseInt(data.housing),
            admin: parseInt(data.admin),
            refugeesPresent: parseInt(data.refugeesPresent)
          },
        });
        // Broadcast the updated data to all connected clients
        const campStats = await getAllCampStats();
        socket.broadcast.emit('camp_stats', campStats, true);
        socket.emit('camp_stats', campStats, true);
      });

      socket.on("updatePathStats", async (data, pathName) => {
        console.log("receieved path update");
        console.log("data: ");
        console.log(data);
        //const{selectedRegion, food, housing, healthcare,} = data
        await prisma.Route.update({
          where: {
            id: parseInt(pathName),
          },
          data: {
            isOpen: data.isOpen
          },
        });
        // Broadcast the updated data to all connected clients
        const routes = await getAllRoutes();
        socket.emit("routes", routes, true);
        socket.broadcast.emit("routes", routes, true);
      });

      

      socket.on("updateGenStats", async (data, genName) => {
        console.log("receieved gen update");
        console.log("data: ");
        console.log(data);
        //const{selectedRegion, food, housing, healthcare,} = data
        await prisma.RefugeeGen.update({
          where: {
            id: parseInt(genName),
          },
          data: {
            totalRefugees: parseInt(data.totalRefugees),
            newRefugees: parseInt(data.newRefugees),
            food: parseInt(data.food),
            healthcare: parseInt(data.healthcare),
            admin: parseInt(data.admin),
            genType: data.genType
          },
        });
        // Broadcast the updated data to all connected clients
        const gens = await getAllGens();
        socket.broadcast.emit('gens', gens, true);
        socket.emit('gens', gens, true);
      });

      socket.on("syncClock", (clientTime, offset) => {
        const now = new Date().getTime;
        const avgOffset = ((now - clientTime) + offset)/2;
        socket.emit('startTimer', avgOffset, timerStopTime);
      });

      socket.on("startTimer", (seconds) => {
        const now = new Date();
        timerStartTime = now.getTime();
        timerStopTime = timerStartTime + seconds*1000;
        timerRunning = true;
        socket.emit('syncClock', now);
        socket.broadcast.emit('syncClock', now);
      });

      socket.on("stopTimer", () => {
        timerRunning = false;
        socket.emit('stopTimer');
        socket.broadcast.emit('stopTimer');
      });

      
    });
  }
  res.end();
};

export default SocketHandler;