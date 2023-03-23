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

const ACCTS = process.env.ACCTS ? process.env.ACCTs : `${process.env.HOME}/accts` 


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

const contextualQuery = async (input, state) => {
  const kb = new KnowledgeBase('kb')
  let hist = await state.getRecentHistory()
  hist = hist.map( h => h.content + '\n' )
  let KBINFO = ''

  try {
    let snippets = await kb.search(hist)
    //snippets = snippets.slice(0,3)
    if (snippets && snippets.length>0) { 
      let kbprompt = `
The following knowledegbase sections have the closest vector (embedding) similarity to the query. Some are probably relevant:
${LINE}
${snippets.join(LINE)} + ${LINE} +
Using the above information as a reference, but ignoring any irrelevant sections, answer the follwing question:
${input}`
    } else {
      console.log('NO KB MATCHES!!')
    }
  } catch (e) {
    console.warn('Potential issue searching KB')
    console.warn(e)
    console.warn('may be normal if no KB data')
  }
  if (KBINFO.length == 0) {
    console.log('No KB search matches')
  }
  let res = await askChat(acct, tosend, {}, streamUpdate)
  console.log({result:res[0]})
  if (res[0]) {
    state.kb = res[0]
  } else {
    throw new Error('Did not receive response from KB summarization.')
  }
}

async function test() {

}
 

test().catch(console.error)


