var aws = require('aws-sdk');

function doSomething(name, context, cb) {
  var dynamodb = new aws.DynamoDB();
  dynamodb.getItem({
    TableName: 'test',
    Key: { name: { S: name } }
  }, function (err, data) {
    if (err) {
      console.log(err);
      context.fail(err);
    } else {
      cb(data.Item.value.S);
    }
  });
}

exports.handler = function (event, context) {
  console.log('Received DoSomething event.');
  doSomething(event.name, context, function (res) {
    context.succeed(res);
  });
};
