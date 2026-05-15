# palworld dedicated server

today's date is 2026-05-15T16:02:03Z

here are some steps, in case you forget how to do this.

1. use [DepotDownloader](https://github.com/steamre/depotdownloader) to get some stuff
	- for Palworld dedicated server:
		- `./DepotDownloader -app 2394010 -depot 2394012 -manifest 5125159522749666228`
	- for steamworks sdk redist:
		- `./DepotDownloader -app 90 -depot 1006 -manifest 6403079453713498174`
	- [info about](https://steamdb.info/depot/1006/manifests/) the [latest manifests is on SteamDB](https://steamdb.info/depot/2394012/manifests/)
	- DepotDownloader is bc i couldn't get SteamCMD to work in Rocky Linux 10 (bc SteamCMD a 32-bit binary)
	- and also, some stuff will have to be copied:
		- `cp -r depots/1006/15961496/ depots/2394012/22460594/`
		- `cp depots/2394012/22460594/DefaultPalWorldSettings.ini depots/2394012/22460594/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini`
1. change a couple of things
	- `nano depots/2394012/22460594/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini`
	- set your `AdminPassword`
	- also, true the `RESTAPIEnabled`
1. copy an existing save file
	- you can probably find it in the `%appdata%` folder
		- `%appdata%\Local\Pal\Saved\Savegames\<some numbers>\<some numbers and letters>`
	- it's probs gonna go in `depots/2394012/22460594/Pal/Saved/SaveGames/0/<some numbers and letters>`
	- this is why we installed putty and pscp
	- if there's a `WorldOption.sav`, you gotta delete it, otherwise the `AdminPassword` won't set
1. you're also probs gonna need to edit the save, bc the former host probs has a goofy userid of "oops all zeros."
	- [PalworldSaveTools](https://github.com/deafdudecomputers/PalWorldSaveTools)
	- figure it out (it's not so bad)
1. put the palworld somewhere safe
	- `sudo cp -r depots/2394012/22460594 /opt/palworld`
	- `sudo chown -r johnmadden:johnmadden /opt/palworld`
	- if your username isn't `johnmadden`, then you'll have to change that part i guess
1. use some very nice files
	- thanks gemini
		- `cp palman.js /opt/palworld/palman.js`
		- `sudo cp palworld.service /etc/systemd/system/palworld.service`
			- you also gotta edit this one
			- if you think it would help, consider legally changing your name to `johnmadden`
	- `sudo systemctl daemon-reload`
	- `sudo systemctl enable palworld`
	- `sudo systemctl start palworld`

---

what's with the javascript file?
 
- by default, the palworld dedicated server continues the flow of time even when no players are connected.
- imo that's kinda annoying.
- so i'm using node.js to start the server when people try to connect and then stop the server when nobody is on.

---

don't drink and drive.
