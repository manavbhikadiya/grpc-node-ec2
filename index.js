const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");

const PORT = 8000 || process.env.PORT;
const HOST = "localhost" || process.env.HOST;
const filePath = "file.txt";

const s3 = new AWS.S3();

const PROTO_FILE = path.join(__dirname, "services.proto");

const options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const packageDefinations = protoLoader.loadSync(PROTO_FILE, options);
const servicesProto = grpc.loadPackageDefinition(packageDefinations);
const server = new grpc.Server();
const bucketName = "grpc-data-bucket";

// StoreData Service
server.addService(servicesProto.StoreDataService.service, {
  StoreData: (call, callback) => {
    const { data } = call.request;
    try {
      fs.writeFile(filePath, data, (err) => {
        if (err) {
          const failureResponse = {
            error: "Error in creating file.",
          };
          callback(null, failureResponse);
        } else {
          const fileData = fs.readFileSync(filePath);
          const s3Params = {
            Bucket: bucketName,
            Key: filePath,
            Body: fileData,
          };

          s3.upload(s3Params, (err, data) => {
            if (err) {
              const failureResponse = {
                error: "Error in uploading file to S3 bucket.",
              };
              callback(null, failureResponse);
            }
            const successResponse = {
              s3uri: data.Location,
            };
            callback(null, successResponse);
          });
        }
      });
    } catch (error) {
      callback(error, null);
    }
  },
});

// AppendData Service
server.addService(servicesProto.AppendDataService.service, {
  AppendData: (call, callback) => {
    const { data } = call.request;
    try {
      fs.appendFile(filePath, "\n" + data, (err) => {
        if (err) {
          const failureResponse = {
            error: "Error in Appending Data in file.",
          };
          callback(null, failureResponse);
        } else {
          const fileData = fs.readFileSync(filePath);
          const s3Params = {
            Bucket: bucketName,
            Key: filePath,
            Body: fileData,
          };

          s3.upload(s3Params, (err, data) => {
            if (err) {
              const failureResponse = {
                error: "Error in uploading file to S3 bucket.",
              };
              callback(null, failureResponse);
            }
            const successResponse = {
              s3uri: data.Location,
            };
            callback(null, successResponse);
          });
        }
      });
    } catch (error) {
      callback(error, null);
    }
  },
});

// DeleteFile Service
server.addService(servicesProto.DeleteDataService.service, {
  DeleteFile: (call, callback) => {
    const { s3uri } = call.request;
    try {
      const urlParts = s3uri.split("/");
      const objectKey = urlParts.slice(3).join("/");

      const headParams = {
        Bucket: bucketName,
        Key: objectKey,
      };

      // Check if the object exists in S3
      s3.headObject(headParams, (err, data) => {
        if (err && err.code === "NotFound") {
          const response = {
            message: "File has been Deleted.",
          };
          callback(null, response);
        } else {
          const deleteParams = {
            Bucket: bucketName,
            Key: objectKey,
          };

          s3.deleteObject(deleteParams, (err, data) => {
            if (err) {
              const failureResponse = {
                message: "File Not Deleted.",
              };
              callback(null, failureResponse);
            } else {
              const successResponse = {
                message: "File Deleted Successfully.",
              };
              callback(null, successResponse);
            }
          });
        }
      });
    } catch (error) {
      callback(error, null);
    }
  },
});

server.bindAsync(
  `${HOST}:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (error, PORT) => {
    if (error) {
      console.error(`Failed to start gRPC server: ${error}`);
      return;
    }
    console.log(`Listening to the PORT ${PORT}.`);
    server.start();
  }
);
