const express = require('express')
const path = require('path')
const bcrypt = require('bcrypt')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

const convertDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDbObjectToResponseObject2 = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

// LOGIN API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const loginQuery = `SELECT * FROM user WHERE username='${username}';`
  const dbUser = await db.get(loginQuery)

  if (dbUser === undefined) {
    response.status(400).send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched) {
      const payload = {username: username}
      const jsonToken = jwt.sign(payload, 'secret')
      response.send({jwtToken: jsonToken})
    } else {
      response.status(400).send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'secret', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
// Get states API
app.get('/states/', authenticateToken, async (request, response) => {
  console.log('hander function')
  const getStatesQuery = `
    SELECT
      *
    FROM
      state
    ORDER BY
      state_id;`
  const StatesArray = await db.all(getStatesQuery)
  response.send(
    StatesArray.map(eachState => convertDbObjectToResponseObject(eachState)),
  )
})

//api2

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
    SELECT
        *
    FROM
        state
    WHERE
        state_id = ${stateId};`
  const StatesArray = await db.get(getStateQuery)
  response.send(convertDbObjectToResponseObject(StatesArray))
})

//api 3

//post book API
app.post('/districts/', authenticateToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const addDistrictQuery = `
    INSERT INTO
      district (district_name,
    state_id,
    cases,
    cured,
    active,
    deaths
    )
    VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
         
      );`
  const dbResponse = await db.run(addDistrictQuery)
  const districtsId = dbResponse.lastID
  response.send('District Successfully Added')
})

//api 4
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
    SELECT
        *
    FROM
        district
    WHERE
        district_id = ${districtId};`
    const districtsArray = await db.get(getDistrictQuery)
    response.send(convertDbObjectToResponseObject2(districtsArray))
  },
)

//api 5
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
    DELETE FROM
        district
    WHERE
        district_id = ${districtId};`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//api 6
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const updateDistrictQuery = `
    UPDATE
      district
    SET
      district_name = '${districtName}', 
      state_id = ${stateId},             
      cases = ${cases},                  
      cured = ${cured},                  
      active = ${active},                
      deaths = ${deaths}
    WHERE
     district_id = ${districtId};`
    const dbResponse = await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

//api 7
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateStatsQuery = `
SELECT
SUM(cases),
SUM(cured),
SUM(active),
SUM(deaths)
FROM
district
WHERE
state_id=${stateId};`
    const stats = await db.get(getStateStatsQuery)
    console.log(stats)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
