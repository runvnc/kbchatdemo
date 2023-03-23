import {readFile, appendFile, writeFile} from "fs/promises"
import fsx from 'fs-extra'
import path from 'path'
import { Configuration, OpenAIApi } from "openai"
import crypto from 'crypto'
import cosineSimilarity from 'cos-similarity'
import shellEscape from 'shell-escape'
import childproc from 'child_process'
import {promisify} from 'util'
const exec = promisify(childproc.exec)

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

const ACCTS = process.env.ACCTS ? process.env.ACCTS : '/home/runvnc/accts'

export default class KnowledgeBase {

  constructor(name) {
    this.name = name

    this.dir = `${ACCTS}/${name}/.kb`
  }

  async createIfNecessary(fname) {
    try {
      await fsx.mkdirp(path.dirname(fname))
    } catch (e) {
      console.error(2)
      console.error(e)
    }
    try {
      await readFile(fname) 
    } catch (e) {
      console.error(3)
      console.error(e)
      await writeFile(fname, '')
    }
  }

  async getHash(text) {
    return await crypto.createHash('sha256').update(text).digest('hex')
  }

  async find(id) {
    try {
      let data = await readFile(this.dir+'/'+id, 'utf8')
      return data
    } catch (e) {
      return 
    }
  }

  async add({file, lineNumber, section, text}) {
    let filename = file
    const id = await this.getHash(text)
    if (await this.find(id)) return
    const response = await openai.createEmbedding({
      model: "text-embedding-ada-002", input: text
    })
    console.log(response.data.data)
    let data = {filename, lineNumber, section, id}
    if (response.data.data) {     
      console.log(1,data)
      Object.assign(data, {embedding: response.data.data[0].embedding}) 
      console.log(2,data)
      const json = JSON.stringify(data)
      await this.createIfNecessary(this.dir+'/kb.json')
      await appendFile(this.dir+'/kb.json', json+'\n', 'utf8') 
      await writeFile(this.dir+'/'+data.id, text)
    }
 }

async load() {
  let file = await readFile(`${this.dir}/kb.json`, 'utf8')
  let lines = file.split('\n')
  this.knowledge = []
  for (let line of lines) {
    if (!line) continue
    this.knowledge.push(JSON.parse(line))
  }
  return this.knowledge
}

async isEmpty() {
  try {
    await this.load()
    return false
  } catch (e) {
    return true
  }
}

 async search(text) {
   let data
   try {
     data = await this.load()
   } catch (e) {
     return []
   }
   const response = await openai.createEmbedding({
      model: "text-embedding-ada-002", input: text
   })
   if (response.data.data) {
     let embedding = response.data.data[0].embedding
     console.log({embedding})
     let knowledge = data.sort( (a,b) => {
       let similarityA = cosineSimilarity(a.embedding, embedding)
       let similarityB = cosineSimilarity(b.embedding, embedding)
       console.log({similarityA, similarityB})
       if (similarityA < similarityB) return 1
       if (similarityA > similarityB) return -1
       return 0
     })
     console.log({knowledge})
     let totalLength = 0
     let results = []
     for (let i=0; i<10 && i<knowledge.length; i++) {
       let snippet = await readFile(`${this.dir}/${knowledge[i].id}`, 'utf8')
       totalLength += snippet.length
       if (totalLength < 2500*3) {
         results.push(snippet)
       }
     }
     return results
   }
 }

  splitTextDocument(text, chunkSize) {
    let textString = text;
    let wordsArray = textString.split(' ')
    let chunksArray = []
    let currentChunk = ''
    for (let i = 0; i < wordsArray.length; i++) {
      currentChunk += wordsArray[i] + ' '
      if (currentChunk.split(' ').length >= chunkSize) {
         chunksArray.push(currentChunk)
         currentChunk = ''
      }
    }
    if (currentChunk != '') chunksArray.push(currentChunk)
    return chunksArray
  }


  // This function takes a string with a markdown document as an argument and parses it out into sections divided by headings, where each section is 500 words or less, source code is not split up, and for each section output an object with these fields sectionName headingname_subheading_name, lineNumber, text

  parseMarkdown (file, markdownString) {
    const lines = markdownString.split('\n')

    const sections = []

    let currentSection = { file, section: '', line: 0, text: '' }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('#')) {

        if (currentSection.text.length > 0) {
          sections.push(currentSection)
        }

        currentSection = { file, section: '', line: i, text: '',}

        currentSection.sectionName = line.replace(/#/g, '').trim()
   
      } else {
        currentSection.text += line + '\n'
      }

      if (currentSection.text.split(' ').length > 500) {
        sections.push(currentSection)

        currentSection = { file, section: '', line: i, text: '' }
      }
    }

    sections.push(currentSection)

    return sections
  }

 onlyFromHashtag(url, markdown) {
   let lines = markdown.split('\n')
   if (!url.includes('#')) return markdown
   let parts = url.split('#')
   let hash = parts[1]
   if (hash.includes('?')) {
     let parts2 = hash.split('?')
     hash = parts2[0]
   }
   let out = []
   let found = false
   for (let line of lines) {
     if (line.includes('{#'+hash)) {
       found = true       
     }
     if (found) out.push(line)
   }
   return out.join('\n')
 }

 async addHTMLDocument(url, updatefn) {
    let filename = this.dir + '/' + url.replace(/\W/g, "_")
    try {
      await fsx.mkdirp(this.dir)
    } catch (e) { }
 
    let args = ['./tomkd.sh', url, filename ]

    let escaped = shellEscape(args)
    console.log({escaped})
    const { stdout, stderr } = await exec(escaped)
    console.log({stdout, stderr})
    let docText = await readFile(filename+'.md', 'utf8')
    //docText = this.onlyFromHashtag(url, docText)
    let parts = this.parseMarkdown(filename+'.md', docText)
    if (updatefn) await updatefn('Found parts: '+parts.length)
    let n = 0
    for (let part of parts) {
      if (updatefn) await updatefn(`Adding part ${n+1} of ${parts.length}`)
      await this.add(part)
      n++
    }
  }

  async addDocument(filename, updatefn) {
    if (filename.includes('.html')) 
      return await this.addHTMLDocument(filename, updatefn)

    let docText = await readFile(filename, 'utf8')
    //let parts = docText.split(/\n\s*\n/)
    console.log('filename = ', filename)
    console.log({docText})
    let parts = this.splitTextDocument(docText, 2500)
    console.log('addDocument found parts: ',parts.length)
    if (updatefn) await updatefn('Found parts: '+parts.length)
    let n = 0
    for (let part of parts) {
      if (updatefn) await updatefn(`Adding part ${n} of ${parts.length}`)
      await this.add({file:filename, lineNumber:0, section: 'Main',
                      text: part})
      n++
      console.log('added part')
    }
  }

}

async function test() {
  let kb = new KnowledgeBase('runvnc')
  await kb.add({file: 'test.txt', lineNumber: 0, section: 'Main',
          text: 'There is exactly one coolguy. He is Bob.'})
  await kb.add({file: 'text.txt', lineNumber: 1, section: 'Main',
          text: 'Tom is not cool, neither is Mary'}) 
  await kb.add({file: 'birds.txt', lineNumber:0, section: 'Main',
                text: 'Parrots can be very noisy, especially in large flocks.'})
  let relevant = await kb.search("Which person is least popular?")
  console.log(relevant)
}

async function test2() {
  let kb = new KnowledgeBase('runvnc')
  //await kb.addDocument('algorand1.txt', (s) => console.log(s))
  let relevant = await kb.search("Given the task of transferring 5 ALGO to address RECV1 in Javascript, implement step 2: sign a transaction")
  console.log(relevant)
}

async function test3() {
  let kb = new KnowledgeBase('tom/bn19')
  //await kb.addDocument('algorand1.txt', (s) => console.log(s))
  let relevant = await kb.search("HTTP API call to get the forecasted temperature for the next 2 hours in a certain location.")
  console.log(relevant)
}


//test3().catch(console.error)

