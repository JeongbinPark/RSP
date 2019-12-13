var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var express = require('express');


app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendFile(__dirname+'/RSP.html');
});

var player1 = '';
var player2 = '';
var player_counter = 0;
var rsp = ["scissors", "rock", "paper"];
var player1_select = '';
var player2_select = '';
var score1 = 0;
var score2 = 0;
var intr; //interval for timer
var waiting_game; //timeout for waiting playing game
var results_by_round = [];  //socket id log for results by round
var running_time = 10; //gaming time per round
var time = -1;  //left gaming time per round;
var round = 0;

io.on('connection', function(socket){
  //connection
  if(player1 == '') {
    player1 = socket.id;
  }
  else if(player2 == '') {
    player2 = socket.id;
  }
  else{
    console.log(socket.id + ' connection rejected');
  }

  game_message('( id : ['+socket.id+']) user connected');
  io.emit('player2', player2);
  io.emit('player1', player1);
  console.log(socket.id +'a user connected');
  console.log('now ' + socket.server.engine.clientsCount+' user(s) connected');
  player_counter = socket.server.engine.clientsCount;

//disconnection
  socket.on('disconnect', function(){
    if(socket.id == player1) {
      player1 = '';
    }
    else if(socket.id == player2) {
      player2 = '';
    }
    else {
      console.log('disconnect error!');
      player1='', player2='';
    }

    game_message('( id : ['+socket.id+']) user disconnected');
    io.emit('player1', player1);
    io.emit('player2', player2);
    console.log(socket.id +'use disconnected');
    player_counter = socket.server.engine.clientsCount;

    Init_Settings();
  });
  Game_Start();
});




//round
//init round
function Init_Round(){
  round = 0;
}
//update round
function update_Round(){
  io.emit('round', round);
}



//score
//init score
function Init_Score(){
  score1 = 0;
  score2 = 0;
}
//update score
function update_score(){
  io.emit('score1', score1);
  io.emit('score2', score2);
};




//check if two players exist
function check_two_players(){
  if(player1 !== '' && player2 !== '') return true;
  return false;
}
//init score, selection, round, timer, and block selection
function Init_Settings(){
      Init_Score();
      update_score();
      Init_RSP();
      update_RSP();
      Init_Round();
      update_Round();
      Init_Timer();
      Init_Results();
      io.emit('block', true);
}




//init setting at the beginning, and call new game
function Game_Start(){
    Init_Settings();
    if(check_two_players()) {
      clearTimeout(waiting_game);
      game_message('The Game will start after 5 seconds.');
      waiting_game = setTimeout(function(){
        Game_Play();
      },5000);
    }
};
//play nth round
function Game_Play(){
  var round =  results_by_round.length + 1;

  var ordinal_num = change_to_ordinal(round);
  console.log("ROUND : ", ordinal_num);
  game_message(ordinal_num+' Round starts!');

  io.emit('round', round);
  Init_RSP();
  update_RSP();
  Init_Timer();
  Result_after_Timeout(); //call Timer and pass the result
}
//change cardinal number to ordinal number
function change_to_ordinal(num){
   if(parseInt(num / 10) !== 1 && num % 10 === 1) return num+'st';
   else if(parseInt(num / 10) !== 1 && num % 10 === 2) return num+'nd';
   else if(parseInt(num / 10) !== 1 && num % 10 === 3) return num+'rd';
   else return num+'th';
}




//selection
//init selection
function Init_RSP(){
  player1_select = rsp[0];
  player2_select = rsp[0];
}
//update selection
function update_RSP(){
  io.emit('player1_select', player1_select);
  io.emit('player2_select', player2_select);
}
//change selection
io.on('connection', function(socket){
  socket.on('selection', function(select){
    console.log(socket.id + ' : '+ select);
    if(socket.id == player1) {
      player1 = socket.id;
      player1_select = select;
    }
    else if(socket.id == player2) {
      player2 = socket.id;
      player2_select = select;
    }
    update_RSP();
  })
});





//inint timer
function Init_Timer(){
  io.emit('timer', running_time);
  clearInterval(intr);
}
//selecting timer
function Timer(){
  io.emit('block', false);
  return new Promise(function(resolve, reject){
  time = running_time;
  intr = setInterval(function(){
    console.log("timer : ", time);
    io.emit('timer', time);
    if(time > 0) time--;
    else{
      resolve(time);
      clearInterval(intr);
    }
  }, 1000);
})
}


//run timer then get result
async function Result_after_Timeout(){
  var result = await Timer();
  if(!result) io.emit('block', true);
  Round_Result();
}




//result
//Round result (compare selections)
function Round_Result(){
  console.log("Result!");
  console.log(player1_select," vs ", player2_select);

  if(player1_select===player2_select) {
    game_message('비겼습니다.');
    results_by_round.push(0);
  }
  else if(( player1_select=== rsp[0] &&  player2_select=== rsp[2] ) ||( player1_select===rsp[1] &&  player2_select===rsp[0] ) ||( player1_select===rsp[2] &&  player2_select===rsp[1] )){
    score1++;
    game_message('player1이 승리하였습니다.');
    results_by_round.push(player1);
    io.emit('win', 1);
  }
  else{
    score2++;
    game_message('player2이 승리하였습니다.');
    results_by_round.push(player2);
    io.emit('win', 2);
  }
  update_score();
  next_round();
}


//check end(check if there's any winner)
function check_end(){
  return new Promise(function(resolve, reject){
    if(score1===5 || score2===5) resolve(true);
    else resolve(false);
    reject();
  })
}
//if game ends, print final result,   if not, go to next round after 3 seconds
async function next_round(){
  var is_end = await check_end();
  if(is_end) Final_Result();
  else setTimeout(function(){
    Game_Play();
  },3000);
}
//results log init
function Init_Results(){
  results_by_round = [];
}
//pass the final results to clients
function Final_Result(){
  io.emit('results array', results_by_round);
  var next_game_time = 5;
  var interval = setInterval(function(){
    console.log("next : " + next_game_time);
    if(next_game_time <= 0) {
      clearInterval(interval);
      Game_Start();
    }
    else next_game_time--;
  },1000)
}




//chatting
//user message
io.on('connection', function(socket){
  socket.on('chat message', function(msg){
    io.emit('writer', socket.id);
    io.emit('chat message', msg);
  });
});
//game manager message
function game_message(text){
  io.emit('writer', 0);
  io.emit('chat message', text);
}



http.listen(3000, function(){
  console.log('listening on *:3000');
});
