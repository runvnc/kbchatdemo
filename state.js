const fs = require('fs/promises')
const fs2 = require('fs-extra')
const path = require('path')


const ACCTS = process.env.ACCTS ? process.env.ACCTs : `${process.env.HOME}/accts` 


let appStates = {}

class InteractionState {
  constructor(filePath) {
    this.filePath = filePath
    this.step = 0
    this.lastUserReply = '.....'
    this.loadState().catch(console.error)
    this.list
    console.log('loaded history')
 }

 async clear() {
   await this.writeAll([])
 }

 static async get(acct) {
   if (appStates[acct]) return appStates[acct]
   appStates[acct] = new InteractionState(`${acct}/.chathistory`)
   return appStates[acct] 
 }

  async addUserReply(reply) {
    if (reply == this.lastUserReply) {
      console.log('Ignoring duplicate user reply (probably retry from error)')
      console.log({reply})
      return
    }
    let data = await this.readFile()
    if (!data) data = []
    if (reply.startsWith('<<')) {
      data.push({role: 'user', content: reply})
      this.lastUserReply = reply
    } else {
      data.push({role: 'user', content: reply})
      this.lastUserReply = reply
    }
    await this.writeAll(data)
  }

  dropTalkAfterCmd(reply) {
    let msgs = reply.split('\n')
    let outlines = []
    let foundCmd = false
    for (let line of lines) {
      if (foundCmd && line.startsWith('!!talkuser')) break
      outlines.push(line)
      if (line.startsWith('!!')) foundCmd = true
    }
    return outlines.join('\n')
  }

  async addAIReply(reply) {
    //reply = this.dropTalkAfterCmd(reply)

    let data = await this.readFile()
    if (!data) data = []
    if (typeof(reply) == 'string') {
      if (reply == '!!talkuser ') {
        console.log('Not adding empty talkuser to history.')
        return
      }
 
      data.push({role:'assistant', content:reply})
    } else if (reply.content) {
      console.log({reply})
      if (reply.content == '!!talkuser ') {
        console.log('Not adding empty talkuser to history.')
        return
      }
      data.push(reply)
    } else {
      console.log({reply})
      throw new Error('Unknown reply:'+JSON.stringify(reply))
    }
    await this.writeAll(data)
  }

  async getAllHistory() {
    let data = await this.readFile()
    if (!data) return []
    return data 
  }

  async getRecentHistory(mustFit) {
    let data = await this.readFile()
    if (!data) return []
    let {truncateFront} = await import('./askchat.mjs')
    console.log({data})
    if (mustFit) 
      return truncateFront(data, {mustFit}) 
    else
      return truncateFront(data)
  }

  parseDialogue(str) {
    let arr = str.split('\n');
    let output = []
    let obj = { text: ''}
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i] || arr[i] == '') continue
      if (arr[i].trim().startsWith('!!')) {
        if (obj.text != '') output.push(obj)
        obj = {text:''}
        obj.agent = 'AI'
        obj.text = arr[i].trim().replace('!!talkuser','')
        obj.text = obj.text.replace('!!REQDONE','')
        obj.command = arr[i].trim().split(' ')[0]
      } else if (arr[i].trim().startsWith('User: ')) {
        if (obj.text != '') output.push(obj)
 
        obj = {text:''}
        obj.agent = 'user'
        obj.text = arr[i].trim().replace('User: ','')
      } else {
        obj.text += '\n' + arr[i]
      }
    }
    if (obj.text != '') {
      output.push(obj)
    }

    return output
  }

  async getHistoryJSON() {
    console.log('aa')
    let hist = await this.getRecentHistory()
    return hist
  }

  async readFile() {     // Reads the chat history file and returns its contents as a string.  
    let data
    if (this.list) return this.list
    try {   // Try/catch block to handle any errors that may occur while reading the file.
      let dir = path.dirname(this.filePath)
      try {
        await fs2.mkdirp(dir)
      } catch (e) { }
 
      data = await fs.readFile(this.filePath, 'utf8')
      this.list = JSON.parse(data)
      return this.list
    } catch (err) {
        
      console.error(err)
      console.error(data)
    }
  }

  async writeFile(data) {   // Writes the given data to the chat history file.
    this.list = data
    try {   // Try/catch block to handle any errors that may occur while writing the file.
      await fs.writeFile(this.filePath, JSON.stringify(data),'utf8')
    } catch (err) {
      console.log(err)
    }
  }

  async writeAll(hist) {
    await this.writeFile(hist)
    let dir = path.dirname(this.filePath)
    let info = JSON.stringify({ step: this.step })
    await fs.writeFile(`${dir}/.state.json`, info, 'utf8')
  }

  async loadState() {
    let dir = path.dirname(this.filePath)
    let info = await fs.readFile(`${dir}/.state.json`, 'utf8') 
    Object.assign(this, JSON.parse(info))
  }

}


module.exports = InteractionState

