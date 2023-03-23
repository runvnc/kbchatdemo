import dotenv from 'dotenv'
dotenv.config()


import { askChatContinue as askChat } from './askchat.mjs'
import InteractionState from './state.js'
import fs from 'fs/promises'
import KnowledgeBase from './kb.mjs'
import delay from 'delay'

function trimNewlines(str) {
  let lines = str.split('\n')
  lines = lines.filter( l => l != '' )
  return lines.join('\n')
}


function usr(text) {
  return { role: 'user', content: text }
}

function sys(text) {
  return {role: 'system', content: text}
}

function ass(text) {
  return {role: 'assistant', content: text}
}


const sendAndRecord = async (text, state, upd) => {
  await streamCmd(text, upd) 
  await state.addAIReply(text)
}

const LINE = '\n--------------------------------------------------------------------\n'

const contextualQuery = async (input, acct, state, streamUpdate) => {
  const kb = new KnowledgeBase('kb')
  let hist = await state.getRecentHistory()
  
  let res
  try {
    let snippets = await kb.search(hist)
    //snippets = snippets.slice(0,3)
    if (snippets && snippets.length>0) { 
      let kbprompt = `
The following knowledegbase sections have the closest vector (embedding) similarity to the query. Some are probably relevant:
${LINE}
${snippets.join(LINE)} + ${LINE} +
Using the above information as a reference, but ignoring any irrelevant sections, answer the following question:
${input}`
    let tosend = hist
    tosend.push(usr(kbprompt))
    res = await askChat(acct, tosend, {}, streamUpdate)
    console.log({result:res[0]})
    } else {
      console.log('NO KB MATCHES!!')
    }
  } catch (e) {
    console.warn('Potential issue searching KB')
    console.warn(e)
    console.warn('may be normal if no KB data')
  }
 if (res[0]) {
    state.kb = res[0]
    state.addAIReply(res[0])
  } else {
    throw new Error('Did not receive response from KB summarization.')
  }
}

function showupd(d) {
  process.stdout.write(d.content)
}

async function test() {
  let state = await InteractionState.get('testacct')
  let query = "Summarize the process of creating an agricultural development district."
  console.log()
  let result = await contextualQuery(query, 'testacct', state, showupd)
  console.log({result})
}
 

test().catch(console.error)


