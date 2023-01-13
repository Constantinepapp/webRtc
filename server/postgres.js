const pool = require("./db")


// async function getHrvToDay(userid){
    
//     const query = `select * from heartratedata where is_rest = true;`
    
//     const result = await pool.query(query)

//     const takeResults = result.rows
//     console.log(takeResults)
//     for(let entry of takeResults){
//         let {timestamp,tags,sleep,water,activity,food,user_id} = entry
//         timestamp = getPreviousDay(new Date(timestamp)).toISOString()
        
        
//        console.log(entry)
        
//         const query = `insert into daydata (timestamp,tags,user_id,sleep,water,activity,nutrition) values($1,$2,$3,$4,$5,$6,$7);`
    
//         const result = await pool.query(query,[new Date(timestamp),tags,user_id,sleep,water,activity,food])
    
//     }

    
// }
// function getPreviousDay(date = new Date()) {
//     const previous = new Date(date.getTime());
//     previous.setDate(date.getDate() - 1);
  
//     return previous;
//   }
async function getDayEntries(userid){
    
    const query = `select * from daydata where user_id = $1;`
    
    const result = await pool.query(query,[userid])
    
    return result?.rows
}


async function getHr(userid){
    
    const query = `select * from heartratedata where user_id = $1;`
    
    const result = await pool.query(query,[userid])
    return result?.rows
}

async function getHrv(userid){
    
    const query = `select * from hrv_data where user_id = $1;`
    
    const result = await pool.query(query,[userid])
    return result?.rows
}

async function getAllUsers(){
    const query = `select * from users`
    const result = await pool.query(query)
    return result?.rows
}


async function newHr(data,user){
    let {signal_arr,position,heartRate,timestamp,isRest,frame_rate,tags,sleep,water,activity,food} = data
    const user_id = user.user_id

    const positionToDb = {'lying':'L','standing':'U',"sitting":'D'}
    // position = positionToDb[position]
    if(!heartRate){
        heartRate = data.hr
    }
    if(!signal_arr){
        signal_arr = []
    }
    if(!frame_rate){
        frame_rate = 15
    }
    if(!isRest){
        sleep = null
        water = null
        activity = null
        food = null
        isRest = false
    }
    
    const query = `insert into heartratedata (timestamp,position,is_rest,hr,frame_rate,tags,user_id,sleep,water,activity,food) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);`

    const result = await pool.query(query,[new Date(timestamp),position,isRest,heartRate,frame_rate,tags,user_id,sleep,water,activity,food])

    return result
}

async function newDay(data,user){
    let {timestamp,tags,sleep,water,activity,food} = data
    const user_id = user.user_id

   
    console.log(data)
    const query = `insert into daydata (timestamp,tags,user_id,sleep,water,activity,nutrition) values($1,$2,$3,$4,$5,$6,$7);`

    const result = await pool.query(query,[new Date(timestamp),tags,user_id,sleep,water,activity,food])

    return result
}


async function editDay(data){
    let {timestamp,tags,sleep,water,activity,food,id} = data


    const query = `update daydata set tags = $1,sleep = $2,water=$3,activity =$4,nutrition=$5 where id=$6;`

    const result = await pool.query(query,[tags,sleep,water,activity,food,id])

    return result
}

async function newHrv(data,user){
    let {signal_arr,position,heartRate,timestamp,isRest,frame_rate,tags,sdnn,rmssd,pnn50,hr,sleep,water,food,activity} = data
    const user_id = user.user_id
    
    if(!signal_arr){
        signal_arr = []
    }
    if(!frame_rate){
        frame_rate = 30
    }
    if(!isRest){
        sleep = null
        water = null
        activity = null
        food = null
        isRest = false
    }
    
    
    
    const query = `insert into hrv_data (timestamp,position,is_rest,hr,frame_rate,tags,user_id,pnn50,sdnn,rmssd,sleep,water,food,activity) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14);`

    const result = await pool.query(query,[new Date(timestamp),position,isRest,hr,frame_rate,tags,user_id,pnn50,sdnn,rmssd,sleep,water,food,activity])

    return result
}

async function createUser(email,password,birthday,sex){
    try{
        const query = `insert into users (email,password,birthday,sex) values($1,$2,$3,$4)`
        const result = await pool.query(query,[email,password,birthday,sex])
        return result
    }
    catch(e){
        throw e
        return {error:e}
    }
   
}

async function loginUser(email,password){
    const query = `select * from users where email = $1 and password = $2`
    try{
        const result = await pool.query(query,[email,password])
        return result.rows[0]
    }
    catch(err){
        console.log(err)
        return false
    }
    
}

module.exports = {newHr,getHr,loginUser,newHrv,getHrv,getAllUsers,createUser,newDay,getDayEntries,editDay}