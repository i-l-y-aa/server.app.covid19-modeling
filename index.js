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
  const testFolder = '/root/server/server.app.covid19-modeling'

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
      'https://covid19-modeling.ru/data/' + cur + '-region-data.csv',
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
    '/root/data/data.app.covid19-modeling/covid19-modeling.ru/data/' +
      req.body.region_name +
      '-region-data.csv'
  )
})

app.get('/article', (req, res) => {
  res.download('./modeling_article.pdf')
})

app.get('/api/CovidStaticFilesAntibodies', (req, res) => {
  res.download(
    '/root/data/data.app.covid19-modeling/covid19-modeling.ru/data/novosibirsk-invitro.csv'
  )
})

app.get('/api/csvCovid', (req, res) => {
  var data = fs.readFile(
    '/root/data/data.app.covid19-modeling/covid19-modeling.ru/data/novosibirsk-region-data.csv',
    'utf8'
  )
  res.send(data)
})

app.set('view engine', 'ejs')

app.get('/api/csvCovid/nd', (req, resp) => {
  https
    .get(
      ' https://covid19-modeling.ru/data/novosibirsk-region-data.csv',
      res => {
        let data = ''
        res.on('data', chunk => {
          data += chunk
        })
        res.on('end', async () => {
          const parsedData = await neatCsv(data)
          let data2 = JSON.stringify(parsedData)
          resp.send(data2)
        })
      }
    )
    .on('error', e => {
      console.error(e)
    })
})

app.get('/api/csvCovid/altay', (req, resp) => {
  https
    .get('https://covid19-modeling.ru/data/altay-region-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/omsk-region-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/novosibirsk-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/altay-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/omsk-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/belgorod-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/bryansk-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/vladimir-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/voronezh-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/ivanovsk-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kaluga-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kostroma-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kursk-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/lipeck-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/moscow-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/orel-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/ryazun-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/smolensk-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/tambov-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/tver-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/tula-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/yaroslavl-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kareliya-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/komi-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/arhangelsk-tub-data.csv', res => {
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
    .get('https://covid19-modeling.ru/data/novosibirsk-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/altay-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/omsk-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/belgorod-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/bryansk-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/vladimir-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/voronezh-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/ivanovsk-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kaluga-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kostroma-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kursk-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/lipeck-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/moscow-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/orel-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/ryazun-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/smolensk-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/tambov-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/tver-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/tula-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/yaroslavl-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/kareliya-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/komi-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/arhangelsk-tub-soc-econ.csv', res => {
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
    .get('https://covid19-modeling.ru/data/res_valid.csv', res => {
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
    .get('https://covid19-modeling.ru/data/res_train.csv', res => {
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
