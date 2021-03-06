// Stopgap variables
var playerDBID = -1;
var songDBID = -1;

// Fires when a new DJ gets on the turntables.
// Does nothing currently.
OnAddDJ = function(data) {
	var playerName = data.user[0].name;
	var userid = data.user[0].userid;

	if(nconf.get('enforceQueue'))
	{
		if(djQueue.length > 0 && djList.length >= 4)
		{
			if(isNextDJ(userid))
			{
				djQueue.pop();
			}
			else
			{
				// remove the offender
				bot.remDj(userid);
				bot.speak('Sorry ' + playerName + '. That spot is still reserved for ' + djQueue[0].name);
				return;
			}
		}
	}
	djList.push(data.user[0]);

	if(nconf.get('autodj'))
	{
		if(djList.length > 3)
		{
			bot.remDj();
		}
	}
	//console.log(JSON.stringify(djList));
	//var str = '\u0002' + playerName + '\u000F is now on the decks!';
	//client.say(nconf.get('ircroom,str'));
};

// Fires when a DJ gets off the turntables.
// Does nothing currently.
OnRemDJ = function(data) {
	var playerName = data.user[0].name;
	var userid = data.user[0].userid;

	var newList = djList;
	djList.forEach(function(dj, index) {
		if(dj.userid == userid){
			newList.splice(index,1);
		}
	});
	djList = newList;
	console.log(JSON.stringify(djList));
	if(nconf.get('autodj'))
	{
		if(djList.length <= 2)
		{
			bot.addDj();
			bot.speak("Starting to AutoDJ. If you do not want this, '!dj Auto'");
		}
	}
	//var str = '\u0002' + playerName + '\u000F has given up!';
	//client.say(nconf.get('ircroom,str'));
};

// Fires when there are no more DJs on the turntables.
OnNosong = function(data) {
	var str = '\u0002Oh noes! The room is dead!\u000F';
	if(nconf.get('verbose')) client.say(nconf.get('ircroom'),str);
};

// Fires when a song ends before the next song starts playing.
// We get up/downvote info here. Maybe switch to recording votes as they come in with update_votes and track who is voting?
OnEndsong = function(data) {
	var pid = playerDBID;
	playerDBID = -1;
	var sid = songDBID;
	songDBID = -1;
	var meta = data.room.metadata;
	var upvotes = meta.upvotes;
	var downvotes = meta.downvotes;
	var listeners = meta.listeners;

	var room = data.room.metadata;
	var songPlayer = room.current_dj;

	var myID = nconf.get('USERID');
	if(songPlayer == myID){
		RemLastSongFromQueue();
	}

	if(pid == -1 || sid == -1) return;

	var str = "insert into plays (player,song,upvotes,downvotes,audience) values ("+pid+","+sid+","+upvotes+","+downvotes+","+listeners+")";
	connection.query(str);

};

// Fires when a new song starts playing.
OnNewsong = function(data) {
	var room = data.room.metadata;
	var song = room.current_song;
	var songID = song._id;
	var songTitle = song.metadata.song;
	var songArtist = song.metadata.artist;
	var songPlayer = room.current_dj;

	var myID = nconf.get('USERID');
	if(songPlayer == myID){
		AddRandomSong();
	}
	var str = "insert into songs (name,artist,songid) values (" + connection.escape(songTitle) + "," + connection.escape(songArtist)+ "," + connection.escape(songID) + ") on duplicate key update id=LAST_INSERT_ID(id), lastHeard = now()";
	//console.log("Query: "+ str);
	connection.query(str, function(err,rows) {
		songDBID = rows.insertId;
		//console.log('Song: ' + songDBID);
	});



	bot.getProfile(songPlayer,function(profile) {
		var playerName = profile.name;
		var str = nconf.get('irctopic');
		if(nconf.get('verbose'))
		{
			var str = nconf.get('ttlink') + ' - \u0002' + songTitle + '\u000F (\u0002' + songArtist + '\u000F) - \u0002' + playerName + '\u000F';
			//client.say(nconf.get('ircroom'),str);<br>
			client.send('TOPIC', nconf.get('ircroom'), str);
		}

		connection.query("insert into djs (name,userid) values (" + connection.escape(playerName) + "," + connection.escape(songPlayer)+ ") on duplicate key update id=LAST_INSERT_ID(id), lastHeard = now()", function(err,rows) {
			playerDBID = rows.insertId;
			//console.log('DJ: ' + playerDBID);
		});

	});


};

OnRoomChanged = function(data) {
	data.room.metadata.djs.forEach(function(dj) {
		bot.getProfile(dj, function(profile) {
			djList.push(profile);
			//console.log(JSON.stringify(djList));
		});
	});
};
OnRegistered = function(data) {};
OnDeregistered = function(data) {};
OnUpdateVotes = function(data) {};
OnBootedUser = function(data) {};
OnUpdateUser = function(data) {};
OnNewModerator = function(data) {};
OnRemModerator = function(data) {};
OnSnagged = function(data) {};
OnPM = function(data) {};

// DJ Queue Functions
AddToQueue = function(person) {
	djQueue.push(person);
	//console.log(JSON.stringify(djQueue));
};

RemFromQueue = function(person) {
	var newQueue = djQueue;
	djQueue.forEach(function(dj, index) {
		if(dj.userid == person.userid){
			newQueue.splice(index,1);
		}
	});
	djQueue = newQueue;
	//console.log(JSON.stringify(djQueue));
};
IsNextDJ = function(userid) {
	if(djQueue[0].userid == userid) return true;
	else return false;
}

OnSpeak = function(data) {
	var userid = data.userid;
	var nick = data.name;
	var text = data.text;

	var isValidCommand = text.match(/^!dj (.+)/i);
	if(isValidCommand)
	{
		var tLower = isValidCommand[1].toLowerCase();
		if(tLower == "q+") AddToQueue(data);
		else if(tLower == "q-") RemFromQueue(data);
		else if(tLower == 'auto')
		{
			if(nconf.get('autodj'))
			{
				nconf.set('autodj',false);
				str = "AutoDJ Turned OFF!";
				bot.remDj();
			}
			else
			{
				nconf.set('autodj',true);
				str = "AutoDJ Turned ON!";
			}
			bot.speak(str);			
		}
		else if(tLower == 'begin dj')
		{
			if(nconf.get('autodj'))
			{
				var response = "AutoDJ is turned on, sorry. '!dj Auto' to turn it off."
				bot.pm(response,userid);
			}
			else {
				bot.addDj();
				str = "Starting to DJ!";
			}
		}
		else if(tLower == 'stop dj')
		{
			if(nconf.get('autodj'))
			{
				var response = "AutoDJ is turned on, sorry. '!dj Auto' to turn it off."
				bot.pm(response,userid);
			}
			else
			{
				bot.remDj();
				str = "Not gonna DJ no mo'!";
			}
		}
		else {
			DoChatCommand(userid, isValidCommand[1], function(userid, response) {
				bot.pm(response,userid);
			});
		}

	}
};

// Fires when a PM is sent to the bot on IRC.
OnIRCChat = function(nick,text,message) {
	console.log(nick);
	console.log(text);
	if(nconf.get('authUsers').indexOf(nick) >=0)
	{
		var isValidCommand = text.match(/^!dj (.+)/i);
		if(isValidCommand)
		{
			DoChatCommand(nick, isValidCommand[1], function(nick, response) {
				client.say(nick,response);
			});

		}
	}
};

OnIRCNotice = function(nick, to, text, message) {
	console.log(nick + ':' + text);
};

