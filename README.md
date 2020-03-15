# ASC-rewrite

This is the bot for [ASC](https://discord.gg/Y3WpFhs)

sidenote: as i've never done an open source bot before, if for some reason you want to use this code, use git clone and then run `npm install` and `tsc` should be good to go

**NOTICE**: The attachment logging feature for this bot is striclty locked to one guild, where file permissions are locked, you must have permission to send files to send files, and thus log them, in ASC you must ask a staff member to give you a role to send images, and upon doing so you will recieve a message from ASC (currently not implemented here, but I plan to have that) informing you that your files will be logged for moderation purposes, and not shared outside of the ASC staff team, you can also find a notice of this in the [#information](https://discordapp.com/channels/539355100397699092/635215364950851659/635228376692424714) channel of ASC.
You can request to have any image deleted at any time, and it will be done, by a maximum of 7 days as per [Discord Developer TOS](https://discordapp.com/developers/docs/legal)/[GDPR](https://gdpr-info.eu/), note though, i'll usually do it instantly unless i'm busy with something or not able to do it at the time of request

### Contributing Warning:

For some reason, whenever I try to compile, stuff like
```js
const smth = object?.something;
```
which is meant to compile to,
```js
const smth = object ? object.something : undefined
```
just compiles as-is and is will throw a syntax error when trying to run the bot
so be aware that for whatever reason that feature of TS is unavailable

I will look into this and possibly fix it at another date, or if there is something wrong with my `tsconfig.json` then someone can make a PR to fix it up