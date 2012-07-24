// Stopgap variables
var playerDBID = -1;
var songDBID = -1;

// Fires when a new DJ gets on the turntables.
// Does nothing currently.
OnAddDJ = function(data) {
	var playerName = data.user[0].name;
	var str = '\u0002' + playerName + '\u000F is now on the decks!';
	//client.say(nconf.get('ircroom,str'));
};

// Fires when a DJ gets off the turntables.
// Does nothing currently.
OnRemDJ = function(data) {
	var playerName = data.user[0].name;
	var str = '\u0002' + playerName + '\u000F has given up!';
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


	var str = "insert into songs (name,artist,songid) values (" + connection.escape(songTitle) + "," + connection.escape(songArtist)+ "," + connection.escape(songID) + ") on duplicate key update id=LAST_INSERT_ID(id), lastHeard = now()";
	//console.log("Query: "+ str);
	connection.query(str, function(err,rows) {
		songDBID = rows.insertId;
		//console.log('Song: ' + songDBID);
	});



	bot.getProfile(songPlayer,function(profile) {
		var playerName = profile.name;
		var str = '\u0002' + playerName + '\u000F is playing \u0002' + songTitle + '\u000F by \u0002' + songArtist + '\u000F';
		if(nconf.get('verbose')) client.say(nconf.get('ircroom'),str);

		connection.query("insert into djs (name,userid) values (" + connection.escape(playerName) + "," + connection.escape(songPlayer)+ ") on duplicate key update id=LAST_INSERT_ID(id), lastHeard = now()", function(err,rows) {
			playerDBID = rows.insertId;
			//console.log('DJ: ' + playerDBID);
		});

	});


};

OnRoomChanged = function(data) {};
OnRegistered = function(data) {};
OnDeregistered = function(data) {};
OnSpeak = function(data) {};
OnUpdateVotes = function(data) {};
OnBootedUser = function(data) {};
OnUpdateUser = function(data) {};
OnNewModerator = function(data) {};
OnRemModerator = function(data) {};
OnSnagged = function(data) {};
OnPM = function(data) {};



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

