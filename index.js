const express = require('express')
const cors = require('cors')
const fs = require('fs')
const http = require('http')
var papaparse = require('papaparse')
const neatCsv = require('neat-csv')
const cluster = require('cluster')
const os = require('os')
const spawn = require('child_process').spawn
var bodyParser = require('body-parser')
const https = require('node:https')

const app = express()
app.use(cors())

const numCpu = os.cpus().length

var moment = require('moment')
var fileMatch = require('file-match')

var jsonParser = bodyParser.json()
var urlencodedParser = bodyParser.urlencoded({ extended: false })
app.use(bodyParser.json())

app.get('/datesSEIR', async (req, res) => {
  const process2 = spawn('python3.10', ['./convertCOVID19_f.py'])
  process2.stdout.on('data', data => {
    console.log(data.toString())
  })
  await fs.readFile(
    './parsingCOVID_files/dates.json',
    'utf8',
    (error, data) => {
      if (error) {
        return console.log('error reading file')
      }
      res.send(data)
    }
  )
})

console.log(moment().subtract(0, 'days').format('D.M.YYYY'))
function intervalDelFunc() {
  var data_to_delete = moment().subtract(2, 'days').format('M.D.YYYY')
  console.log(data_to_delete)
  var filter = fileMatch('*_' + data_to_delete + '.json')
  const testFolder = '/root/server_v2/server.app.covid19-modeling'

  fs.readdir(testFolder, (err, files) => {
    if (err) {
      console.error('Ошибка чтения папки:', err)
      return
    }

    if (Array.isArray(files)) {
    files.forEach(file => {
      if (filter(file)) {
        console.log('нашли файл для удаления')
        fs.unlink(file, err => {
          if (err) throw err
          console.log('Файл успешно удалён')
        })
      } else {
        console.log('Файл не найден')
      }
    })
  } else {
    console.error('Ошибка: files не является массивом.')
  }
})
}

setInterval(intervalDelFunc, 86400000) //два дня
////

app.get('/deleteCurFiles', (req, res) => {
  console.log('work')
})

app.get('/getMsim', (req, res) => {
  fs.readFile('./msim_res.json', 'utf8', async (error, data) => {
    if (error) {
      return console.log('error reading file')
    }
    let data2 = JSON.parse(data)
    res.send(data2)
  })
})

app.post('/getUMsim2', urlencodedParser, (req, res) => {
  var now_data = moment().subtract(0, 'days').format('M.D.YYYY')
  fs.readFile(
    './users_msim_res_' +
      req.body.region_data +
      '_' +
      req.body.population_data +
      '_' +
      req.body.init_inf +
      '_' +
      req.body.n_future_day +
      '_' +
      now_data +
      '.json',
    'utf8',
    async (error, data) => {
      if (error) {
        return console.log('error reading file')
      }
      let data2 = JSON.parse(data)
      res.send(data2)
    }
  )
})

app.post('/data', urlencodedParser, (req, res) => {
  run_model(
    req.body.population_data,
    req.body.region_data,
    req.body.n_future_day,
    req.body.init_inf,
    req,
    res
  )
})

function run_model(tt, region_num, n_future, init_inf, req, res) {
  let cur = ''
  if (region_num === 1) {
    cur = 'novosibirsk'
  } else if (region_num === 2) {
    cur = 'omsk'
  } else {
    cur = 'altay'
  }
  https
    .get(
      'https://ai-biolab.ru/data/' + cur + '-region-data.csv',
      res => {
        let data = ''
        res.on('data', chunk => {
          data += chunk
        })
        res.on('end', async () => {
          const parsedData = await neatCsv(data)
          let data2 = JSON.stringify(parsedData)
          fs.writeFile('./curData' + region_num + '.json', data2, err => {
            if (err) throw err
            console.log('Файл успешно скопирован')
          })
        })
      }
    )
    .on('error', e => {
      console.error(e)
    })

  return new Promise((resolve, reject) => {
    var now_data = moment().subtract(0, 'days').format('M.D.YYYY')
    const process = spawn('python3.10', [
      './dlya_kati.py',
      tt,
      region_num,
      n_future,
      init_inf,
      now_data,
    ])
    process.stdout.on('data', data => {
      console.log(data.toString())
    })
    req.connection.on('close', function () {
      process.kill()
      console.log('user cancelled')
    })
    process.on('close', code => res.send('ok'))
  })
}

app.post('/api/curData', urlencodedParser, (req, res) => {
  fs.readFile(
    './curData' + req.body.region_data + '.json',
    'utf8',
    async (error, data) => {
      if (error) {
        return console.log('error reading file')
      }
      res.send(data)
    }
  )
})

app.post('/api/CovidStaticFiles', urlencodedParser, (req, res) => {
  res.download(
    '/root/data/data.app.ai-biolab/ai-biolab.ru/data/' +
      req.body.region_name +
      '-region-data.csv'
  )
})

app.get('/article', (req, res) => {
  res.download('./modeling_article.pdf')
})

app.get('/api/CovidStaticFilesAntibodies', (req, res) => {
  res.download(
    '/root/data/data.app.ai-biolab/ai-biolab.ru/data/novosibirsk-invitro.csv'
  )
})

app.get('/api/csvCovid', (req, res) => {
  var data = fs.readFile(
    '/root/data/data.app.ai-biolab/ai-biolab.ru/data/novosibirsk-region-data.csv',
    'utf8'
  )
  res.send(data)
})

app.set('view engine', 'ejs')

app.get('/api/csvCovid/novosibirsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/novosibirsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/altay', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/altay-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/omsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/omsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/belgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/belgorod-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/bryansk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/bryansk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/vladimir', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/vladimir-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/voronezh', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/voronezh-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/ivanovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ivanovsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kaluga', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kaluga-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kostroma', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kostroma-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kursk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kursk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/lipeck', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/lipeck-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/moscow', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/moscow-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/orel', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/orel-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/ryazun', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ryazun-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/smolensk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/smolensk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/tambov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tambov-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/tver', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tver-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/tula', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tula-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/yaroslavl', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/yaroslavl-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kareliya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kareliya-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/komi', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/komi-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/arhangelsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/arhangelsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/vologda', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/vologda-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kaliningrad', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kaliningrad-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/leningrad', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/leningrad-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/murmansk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/murmansk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/novgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/novgorod-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/pskov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/pskov-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/adygea', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/adygea-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kalmykia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kalmykia-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/krasnodar', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/krasnodar-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/volgograd', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/volgograd-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/rostov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/rostov-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvCovid/dagestan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/dagestan-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvCovid/ingushetia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ingushetia-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvCovid/kabarbalkar', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kabarbalkar-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvCovid/karcherk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/karcherk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/sevosetiaalania', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sevosetiaalania-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/chechnya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chechnya-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/stavrapol', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/stavrapol-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/bashkortostan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/bashkortostan-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/maryal', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/maryal-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/mordovia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/mordovia-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/tatarstan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tatarstan-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/udmurtia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/udmurtia-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/chuvashia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chuvashia-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/perm', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/perm-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kirov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kirov-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/nizhniynovgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/nizhniynovgorod-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/orenburg', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/orenburg-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/penza', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/penza-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/samara', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/samara-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/saratov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/saratov-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/ulyanovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ulyanovsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kurgan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kurgan-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/sverdlov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sverdlov-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/tumen', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tumen-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/chelyabinsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chelyabinsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/respaltay', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/respaltay-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/resptyva', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/resptyva-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/resphakasia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/resphakasia-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/krasnoyarsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/krasnoyarsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/irkutsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/irkutsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kemerovo', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kemerovo-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/tomsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tomsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/buryatia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/buryatia-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/saha', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/saha-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/zabaikalsky', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/zabaikalsky-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/kamchatsky', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kamchatsky-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/primorsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/primorsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/habarovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/habarovsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/amursk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/amursk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/magadan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/magadan-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/sahalin', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sahalin-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/evreiskaya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/evreiskaya-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/chukotsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chukotsk-region-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})





app.get('/api/csvTub/novosibirsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/novosibirsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/altay', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/altay-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/omsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/omsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/belgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/belgorod-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/bryansk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/bryansk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/vladimir', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/vladimir-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/voronezh', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/voronezh-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/ivanovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ivanovsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kaluga', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kaluga-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kostroma', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kostroma-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kursk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kursk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/lipeck', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/lipeck-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/moscow', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/moscow-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/orel', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/orel-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/ryazun', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ryazun-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/smolensk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/smolensk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/tambov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tambov-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/tver', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tver-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/tula', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tula-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/yaroslavl', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/yaroslavl-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kareliya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kareliya-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/komi', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/komi-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/arhangelsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/arhangelsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/vologda', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/vologda-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kaliningrad', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kaliningrad-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/leningrad', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/leningrad-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/murmansk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/murmansk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/novgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/novgorod-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/pskov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/pskov-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/adygea', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/adygea-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kalmykia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kalmykia-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/krasnodar', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/krasnodar-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/volgograd', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/volgograd-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/rostov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/rostov-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvTub/dagestan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/dagestan-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvTub/ingushetia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ingushetia-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvTub/kabarbalkar', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kabarbalkar-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})


app.get('/api/csvTub/karcherk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/karcherk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/sevosetiaalania', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sevosetiaalania-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/chechnya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chechnya-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/stavrapol', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/stavrapol-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/bashkortostan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/bashkortostan-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/maryal', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/maryal-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/mordovia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/mordovia-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/tatarstan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tatarstan-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/udmurtia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/udmurtia-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/chuvashia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chuvashia-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/perm', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/perm-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kirov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kirov-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/nizhniynovgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/nizhniynovgorod-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/orenburg', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/orenburg-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/penza', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/penza-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/samara', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/samara-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/saratov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/saratov-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/ulyanovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ulyanovsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kurgan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kurgan-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/sverdlov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sverdlov-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/tumen', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tumen-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/chelyabinsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chelyabinsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/respaltay', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/respaltay-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/resptyva', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/resptyva-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/resphakasia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/resphakasia-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/krasnoyarsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/krasnoyarsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/irkutsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/irkutsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kemerovo', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kemerovo-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/tomsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tomsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/buryatia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/buryatia-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/saha', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/saha-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/zabaikalsky', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/zabaikalsky-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/kamchatsky', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kamchatsky-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/primorsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/primorsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/habarovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/habarovsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/amursk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/amursk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/magadan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/magadan-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/sahalin', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sahalin-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/evreiskaya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/evreiskaya-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvTub/chukotsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chukotsk-tub-data.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})












app.get('/api/csvSocTub/novosibirsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/novosibirsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/altay', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/altay-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/omsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/omsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/belgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/belgorod-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/bryansk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/bryansk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/vladimir', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/vladimir-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/voronezh', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/voronezh-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/ivanovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ivanovsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kaluga', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kaluga-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kostroma', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kostroma-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kursk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kursk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/lipeck', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/lipeck-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/moscow', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/moscow-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/orel', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/orel-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/ryazun', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ryazun-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/smolensk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/smolensk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/tambov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tambov-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/tver', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tver-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/tula', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tula-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/yaroslavl', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/yaroslavl-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kareliya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kareliya-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/komi', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/komi-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/arhangelsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/arhangelsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/vologda', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/vologda-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kaliningrad', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kaliningrad-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/leningrad', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/leningrad-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/murmansk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/murmansk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/novgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/novgorod-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/pskov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/pskov-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/adygea', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/adygea-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kalmykia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kalmykia-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/krasnodar', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/krasnodar-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/volgograd', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/volgograd-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/rostov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/rostov-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/dagestan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/dagestan-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/ingushetia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ingushetia-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kabarbalkar', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kabarbalkar-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/karcherk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/karcherk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/sevosetiaalania', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sevosetiaalania-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/chechnya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chechnya-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/stavrapol', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/stavrapol-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/bashkortostan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/bashkortostan-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/maryal', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/maryal-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/mordovia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/mordovia-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/tatarstan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tatarstan-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/udmurtia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/udmurtia-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/chuvashia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chuvashia-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/perm', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/perm-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kirov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kirov-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/nizhniynovgorod', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/nizhniynovgorod-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/orenburg', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/orenburg-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/penza', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/penza-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/samara', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/samara-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/saratov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/saratov-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/ulyanovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/ulyanovsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kurgan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kurgan-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/sverdlov', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sverdlov-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/tumen', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tumen-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/chelyabinsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chelyabinsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/respaltay', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/respaltay-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/resptyva', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/resptyva-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/resphakasia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/resphakasia-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/krasnoyarsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/krasnoyarsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/irkutsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/irkutsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kemerovo', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kemerovo-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/tomsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/tomsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/buryatia', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/buryatia-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/saha', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/saha-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/zabaikalsky', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/zabaikalsky-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/kamchatsky', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/kamchatsky-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/primorsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/primorsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/habarovsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/habarovsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/amursk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/amursk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/magadan', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/magadan-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/sahalin', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/sahalin-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/evreiskaya', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/evreiskaya-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvSocTub/chukotsk', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/chukotsk-tub-soc-econ.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})













app.get('/api/res_valid', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/res_valid.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/res_train', (req, resp) => {
  https
    .get('https://ai-biolab.ru/data/res_train.csv', res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', async () => {
        const parsedData = await neatCsv(data)
        let data2 = JSON.stringify(parsedData)
        resp.send(data2)
      })
    })
    .on('error', e => {
      console.error(e)
    })
})

app.post('/api/forecasts', urlencodedParser, (req, res) => {
  fs.readFile(
    './parsingCOVID_files/' + req.body.datatype + '_res_mod_pred.csv',
    'utf8',
    async (error, data) => {
      if (error) {
        return console.log('error reading file!')
      }
      const parsedData = await neatCsv(data)
      let data2 = JSON.stringify(parsedData)
      res.send(data2)
    }
  )
})

app.post('/api/forecasts_true', urlencodedParser, (req, res) => {
  console.log(req.body.datatype)
  fs.readFile(
    './parsingCOVID_files/' + req.body.datatype + '_res_mod_true.csv',
    'utf8',
    async (error, data) => {
      if (error) {
        return console.log('error reading file!')
      }
      const parsedData = await neatCsv(data)
      let data2 = JSON.stringify(parsedData)
      res.send(data2)
    }
  )
})

app.post('/api/forecasts_train', urlencodedParser, (req, res) => {
  fs.readFile(
    './parsingCOVID_files/' + req.body.dataT + '_res_mod_train.csv',
    'utf8',
    async (error, data) => {
      if (error) {
        return console.log('error reading file')
      }
      const parsedData = await neatCsv(data)
      let data2 = JSON.stringify(parsedData)
      res.send(data2)
    }
  )
})

app.listen(process.env.PORT || 4000)
