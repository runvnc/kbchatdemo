import delay from 'delay'
import assert from 'assert'
import {yieldStream} from 'yield-stream'
import { bgGreen, bgGreenBright, blue, bold, underline, whiteBright } from "colorette"

import Bottleneck from "bottleneck"
import GPT3Tokenizer from 'gpt3-tokenizer';
console.log({GPT3Tokenizer})
const tokenizer = new GPT3Tokenizer.default({ type: 'codex' }); // or 'gpt3'
import { OpenAI } from "openai-streams/node"

function getDeltas(ev) {
  let deltas = []
  for (let ch of ev.choices) {
    deltas.push(ch.delta)
  }
  if (deltas.length > 1) {
    throw new Error('Received multiple deltas in an event')
  }
  return deltas[0]
}

async function askChat_(acct, messages, opts, streamUpdate, continuation) {
  if (!Array.isArray(messages)) { messages = [messages] }
  let fullAnswer = []
  let promptMsgs = []
  promptMsgs.push(...messages)

  if (continuation) {
    promptMsgs.push(...continuation)
  }
  console.log('---------------------------------------------------------------------------------')
  console.log({maxTokens: maxTokens(promptMsgs, opts)})

  let cfg = { model: "gpt-3.5-turbo-0301", messages: promptMsgs,
              temperature: 0.0, n: 1, user: acct, 
              max_tokens: maxTokens(promptMsgs, opts),
              presence_penalty: 0 }   

  Object.assign(cfg, opts)
  let currMsg
  console.log(JSON.stringify(cfg, null, 4))

  const stream = await OpenAI("chat", cfg, {mode: 'raw'} )
  //console.log({stream})

  let decoder = new TextDecoder()

  for await (const chunk_ of stream) {
    let chunk = JSON.parse(decoder.decode(chunk_))
    if (chunk.error) {
      console.warn('6666666666666666666666666666666666666666666666666666666')
      console.warn(JSON.stringify(chunk))
      throw new Error(JSON.stringify(chunk))
      return 
    }
    //console.log({chunk:JSON.stringify(chunk,null,4)})
    chunk = getDeltas(chunk)
    if (chunk.role) {
      if (currMsg) {
        fullAnswer.push(currMsg)
      }
      currMsg = {}
      currMsg.role = chunk.role
    } else {
      if (!currMsg?.role) {
        throw new Error('Chat parse error, no role ' + JSON.stringify(chunk))
      }
      if (!currMsg.content) currMsg.content = ''
      if (chunk.content != undefined) {
        if (!(currMsg.content.startsWith('!!')) &&
            !(chunk.content.startsWith('!!'))) {         
          //chunk.content = '!!talkuser '+chunk.content
        }
        currMsg.content += chunk.content
        streamUpdate(chunk)
      }
    }
  }
  if (!(fullAnswer.includes(currMsg))) {
    fullAnswer.push(currMsg)
  }
  promptMsgs.push(...fullAnswer)
  let tokens = tokenCount(promptMsgs)
  return fullAnswer
}

const limiter = new Bottleneck({
  reservoir: 90000,
  reservoirRefreshInterval: 60000,
  reservoirRefreshAmount: 90000,
  reservoirIncreaseAmount: 90000,
  reservoirIncreaseMaximum: 90000
})

const askChat = limiter.wrap(askChat_)

const tokenCount = (msgs) => {
  //console.log({msgs})
  if (!msgs) throw new Error('called tokenCount with undefined messages')
  //console.log({msgs})
  msgs = msgs.filter( m => m != undefined)
  let text = ''
  for (let m of msgs) {
    if (m.content && m.content.length>0) text += m.content
  }
  if (!text || text?.length == 0) return 0

  const encoded = tokenizer.encode(text)
  return encoded.bpe.length
  //const decoded = tokenizer.decode(encoded.bpe)
}

const modelMax = {  'gpt-4': 7900, 
                   'gpt-3.5-turbo': 4096, 
                   'code-davinci-002': 7999,
                   'text-davinci-003': 3999 }
const tokenLimits = { 'code-davinci-002': 999,
                      'text-davinci-003': 700,
                      'gpt-3.5-turbo': 700,
                      'gpt-4': 3000 }
 
const maxTokens = (messages, opts) => {
  //console.log('')
  //console.log(':::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::')
  let model = opts?.model
  if (!model) model = 'gpt-3.5-turbo'
  
  const promptTokens = tokenCount(messages)

  let calc = Math.min(tokenLimits[model], modelMax[model] - promptTokens)
  //console.log('tokenCount:', {promptTokens, model, tokenLimit:tokenLimits[model], calculatedMax:calc})
  return calc   
}

const dropFirstLine = (msg) => {
  let lines = msg.content.split('\n')
  lines = lines.slice(1)
  if (lines.length == 0) return 0
  if (lines.length == 1 && lines[0] == '') {
    return 0
  }
  msg.content = lines.join('\n')
  return lines.length
}

const truncateFront = (messages_, opts) => {
  //
  //console.log({truncateFrontmsgs:messages})
  let messages = []
  for (let m of messages_) messages.push(m)
  
  try {
    assert(messages != undefined)
    let size
    let model = opts?.model
    if (!model) model = 'gpt-3.5-turbo'
    size = modelMax[model] - tokenLimits[model] - 2
    //if (opts?.mustFit) size -= tokenCount([opts.mustFit])
    //let toRemove = tokenCount(messages) - size
    let i = 0
    while (tokenCount(messages) > size) {
      if (messages[i].role == 'system') {
        i += 1
        continue
      }
      let left = dropFirstLine(messages[i])
      if (left == 0) { 
        messages.splice(i,1)
      }
    }

    return messages
  } catch (e) {
    console.error('Problem in truncateFront.')
    console.error(e)
    console.error({messages})
    throw e
  }
}

const updateWithCredits = (acct, opts, upd) => {
  return (obj) => {
   // console.log('################################################################')
   // console.log('updateWithCredits',{obj})
    if (obj.content) {
      let used = tokenCount([obj])
      if (opts.model == 'gpt-4') {
        //useCredits(acct, {gpt4tokens:used}).catch(console.error)
      } else {
        //useCredits(acct, {tokens:used}).catch(console.error)
      }
      try {
     //   console.log('***********************************************************')
        upd(obj)
      } catch (e) {
        console.error('Error calling update:',e)
      }
    }
  }
}

const askChatContinue = async (acct, messages, opts, streamUpdate) => {
  //console.log({acct, messages, opts})
  let upd = updateWithCredits(acct, opts, streamUpdate)
  let continues = 0
  let nextPrompt = messages
  opts.user = acct
  let fullAnswer = []
  while (continues < 7) {    
    try {
      if (continues > 0) {
        console.log(bgGreenBright(whiteBright('continuation #'+continues)))
      }
      //console.log(2,{messages})
      let cnt = tokenCount(messages)
      await useCredits(acct, {tokens:cnt})
      const xopts = { weight: cnt, id: acct+'_'+Date.now() }
      console.log('about to call askchatwithoptions')
      let res = await askChat.withOptions(xopts, acct, nextPrompt, opts, upd)
      //console.log({res})
      let messages2 = res
      //console.log({messages2})
      fullAnswer.push(...messages2)
      nextPrompt.push(...messages2)
      nextPrompt = truncateFront(nextPrompt, opts)
      let numTokens = tokenCount(messages2)
      //console.log({numTokens})
      if (numTokens < maxTokens(messages2, opts)-1) {
        return [fullAnswer, {tokens: tokenCount(fullAnswer)}]      
      } else {
        console.log('askChatContinue')
        console.log(bgGreenBright(whiteBright('numTokens > max, assuming needs continue')))
        console.log({numTokens})
      }
      continues++
    } catch (e) {
      console.error(e)
      console.log({fullAnswer, nextPrompt})
      streamUpdate({error: "Problem with Chat API request: "+e.message})
      return [fullAnswer, {tokens: tokenCount(fullAnswer)}]
 
    }
  }
  return [fullAnswer, {tokens: tokenCount(fullAnswer)}]
}


export {askChatContinue, truncateFront, tokenCount}

