const { MongoClient } = require("mongodb");
const fs = require('fs');
// HkpcuryhyhLazLj4
const pwd = process.env.jeopardybot_password;

const uri = `mongodb+srv://asher:HkpcuryhyhLazLj4@cluster0.u5pnm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`


function run() {
    MongoClient.connect(uri, function(err, database) {
      if (err){
        throw err;
      }
      const question = database.db("QuestionsDB").collection("question");
      
      const questionLines = fs.readFileSync('questions.txt').toString().split('\r\n');
      let allQuestions = [];
      const pattern = /\uFFFD/g;
      
      var id = 0;
      for (let i = 0; i < questionLines.length; i++) {
        line = questionLines[i];
        // console.log(line);
        if(pattern.test(line)){
            continue;
        }
        let parts = line.split("###");
        // console.log(parts);
        let q = {
            "identifier": id,
            "category": parts[0],
            "clue": parts[1],
            "answer": parts[2],
            "reward": parts[3]
        };
        allQuestions = allQuestions.concat(q);
        id++;
      }

      console.log('Creating indexes on identifier.');
      question.createIndex({ identifier: "hashed" }, function(err, indexObj) {
        if (err)
          throw err;
        console.log('Created index:', indexObj);
        question.insertMany(allQuestions, { ordered: true }, (err, insertRes) => {
          if (err)
            throw err;
          if (insertRes.acknowledged) {
            console.log(`Inserted ${insertRes.insertedCount} items`);
          } else {
            console.log('Failed to insert all items.');
            throw 'Insertion failed';
          }
          console.log('Listing all events in database...');
          question.find().toArray(function(err, items) {
            if (err)
              throw err;
            console.dir(items);
            database.close();
          });
        });
      });
    //   database.close();
    })
  }
  run();