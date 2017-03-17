const fs = require('fs-promise')
const Github = require('github')
const { join } = require('path')

const github = new Github({
  protocol: 'https'
})

github.authenticate({
  type: 'token',
  token: process.env.GITHUB_TOKEN
})

const Exec = class Exec {

  constructor (fileName) {
    this.fileName = fileName

    this.fileContents = ''
    this.lines = []

    this.compiledContents = ''
    this.compiledLines = []
  }

  async readFile () {
    let fileContents = await fs.readFile(this.fileName)
    this.fileContents = fileContents.toString()
    this.lines = fileContents.toString().split('\n')
  }

  async replaceExec () {
    return new Promise(async (resolve, reject) => {
      for (const line of this.lines) {
        if (line.indexOf('//') === 0 || line.indexOf('exec') === -1 || line.search(/exec "[A-z0-9]{1,}"/gi) === -1) {
          this.compiledLines.push(line)
          continue
        }

        let [fullMatch, filename] = (/exec "([A-z0-9]{1,})"/gi).exec(line)
        let execFile = new Exec(filename + '.cfg')

        try {
          await execFile.readFile()
          await execFile.replaceExec()
        } catch (readFileError) {
          console.error('readFileError', readFileError)
          return reject(readFileError)
        } finally {
          this.compiledLines.push(...execFile.compiledLines)
        }
      }

      this.compiledContents = this.compiledLines.join('\n')
      return resolve()
    })
  }

}

function getDateString () {
  let d = new Date();
  return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "_" + ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + ("0" + d.getSeconds()).slice(-2);
}

async function main () {
  let autoexec = new Exec('autoexec.cfg')
  await autoexec.readFile()
  await autoexec.replaceExec()
  console.log('Added', autoexec.compiledLines.length - autoexec.lines.length, 'lines.');

  await Promise.all([
    fs.writeFile('compiled/latest.cfg', autoexec.compiledContents),
    fs.writeFile('compiled/' + getDateString() + '.cfg', autoexec.compiledContents),
    github.gists.editComment({
      'gist_id': process.env.GIST_ID,
      id: process.env.COMMENT_ID,
      body: 'Last compiled ' + new Date().toString() + '\n```java\n' + autoexec.compiledContents + '\n```'
    })
  ])
  console.log('Wrote compiled versions to ' + join(__dirname, './compiled'));
}

main()
