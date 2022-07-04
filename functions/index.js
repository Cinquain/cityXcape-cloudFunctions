const functions = require("firebase-functions");

//Initialize Firebase Admin SDK
const admin = require('firebase-admin');
const { messaging } = require("firebase-admin");
const { document } = require("firebase-functions/v1/firestore");
admin.initializeApp()
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

exports.newFollower = functions.firestore
      .document('world/followers/{followingId}/{followerId}')
      .onCreate(async (snapshot, context) => {

        let followerId = context.params.followerId
        let followingId = context.params.followingId
        let data = snapshot.data()
        let displayName = data.displayName
        let profile_image = data.profileImageUrl
        console.log('Following id is ', followingId)
        var db = admin.firestore();

        return db.collection('users').doc(followingId)
        .get()
        .then(snapshot => {
            let data = snapshot.data();
            console.log('data is', data)
            let fcmToken = data.fcmToken;
            console.log('fcm token is', fcmToken)

              var payload = {
                notification: {
                  title: 'New Street Follower',
                  body: displayName + ' is now following you'
                },
                data: {
                  userid: followerId,
                  profileUrl: profile_image,
                  userDisplayName: displayName
                }
              }

              admin.messaging().sendToDevice(fcmToken, payload)
              .then(response => {
                console.log('Successfully sent push notifications', response)
              })
              .catch(error => {
                console.log('Failed to send push notifications', error)
              })

          })
          .catch(error => {
            console.log('Error getting following fcmToken', error)
          })

      })


exports.notifyFollowers = functions.firestore
      .document('posts/{postId}')
      .onCreate(async (snapshot, context) => {

        let data = snapshot.data()
        let ownerId = data.owner_id
        let ownerName = data.ownerDisplayName
        let spotName = data.spot_name
        let spotId = context.params.postId

        var payload = {
          notification: {
            title: ownerName + ' posted a new spot', 
            body: spotName
          },
          data: {
            spotId: spotId
          }
        }
        var db = admin.firestore();
        return db.collection('world').doc('followers').collection(ownerId)
                .get()
                .then(snapshot => {
                  snapshot.forEach( doc => {
                    let data = doc.data()
                    let fcmToken = data.fcmToken
                    admin.messaging().sendToDevice(fcmToken, payload)
                      .then(response => {
                        console.log('Successfully sent push notification', response)
                      })
                      .catch(error => {
                        console.log('Failed to send push notification', error)
                      })
                  })
                })
                .catch(error => {
                    console.log('Failed to fetch followers collection', error)
                })

      });


exports.wroteComment = functions.firestore
        .document('posts/{postId}/comments/{commentId}')
        .onCreate(async (snap, context) => {

          let data = snap.data()
          let commentorId = data.user_id
          let commentorImageUrl = data.profile_image
          let commentorUsername = data.display_name
          let message = data.message
          let postId = context.params.postId

          console.log(commentorId, commentorImageUrl, commentorUsername, postId)

          var db = admin.firestore();

            return db.collection('posts').doc(postId)
            .get()
            .then(snapshot => {
              
              let data = snapshot.data();
              postOwnerId = data.owner_id;
              let spotName = data.spot_name;

                    return db.collection('users').doc(postOwnerId)
                    .get()
                    .then(snapshot => {
                      let ownerData = snapshot.data();
                      let fcmToken = ownerData.fcmToken;

                        var payload = {
                          notification: {
                            title: 'New comment on ' + spotName,
                            body: commentorUsername + ': ' + message
                          },
                          data: {
                            userid: commentorId,
                            profileUrl: commentorImageUrl,
                            userDisplayName: commentorUsername,
                            message: message,
                            spotId: postId
                          }
                        }

                            admin.messaging().sendToDevice(fcmToken, payload)
                            .then(response => {
                              console.log('Successfully sent push notifications', response)
                            })
                            .catch(error => {
                              console.log('Failed to send push notifications', error)
                            })

                      
                        })
                    .catch(error => {
                      console.log('Error fetching fcm token')
                    })
                  })    
            .catch(error => {
              console.log('Error fetching ownerId')
            })
        });


exports.newStamp = functions.firestore
        .document('world/verified/{userId}/{postId}')
        .onWrite(async (change, context) => {


          let verifierId = context.params.userId
          let data = change.after.data()
          console.log(verifierId, data)

          let spotName = data.name;
          let spotImage = data.imageUrl;
          let timestamp =  String(data.time);
          let comment = data.comment;
          let verifierName = data.verifierName;
          let verifierImage = data.verifierImageUrl;
          let spotOwnerId = data.spotOwnerId;
          let commentCount = String(data.comment_count);
          let latitude = String(data.latitude);
          let longitude = String(data.longitude);
          let city = data.city;
          let country = data.country;
          let postId = data.postId;
          console.log(timestamp)

          const db = admin.firestore()

          return db.collection('world').doc('followers').collection(verifierId)
                    .get()
                    .then(snapshot => {
                        snapshot.forEach(doc => {
                          let data = doc.data()
                          let fcmToken = data.fcmToken

                          var payload = {
                            notification: {
                              title: verifierName + " got a new stamp",
                              body: verifierName + ' has checked-in ' + spotName
                            },
                            data: {
                              stampName: spotName,
                              image: spotImage,
                              content: comment,
                              verifierId: verifierId,
                              verifierImage: verifierImage,
                              verifierName: verifierName,
                              time: timestamp,
                              ownerId: spotOwnerId,
                              count: commentCount,
                              latitude: latitude,
                              longitude: longitude,
                              city: city,
                              country: country,
                              postId: postId,
                            }
                          }

                          admin.messaging().sendToDevice(fcmToken, payload)
                                .then(response => {
                                  console.log('Successfully sent push notifications', response)
                                })
                                .catch(error => {
                                  console.log('Failed to send push notifications', error)
                                })

                        })
                    })
                    .catch(error => {
                      console.log('Error finding followers', error)
                   })
                        

        })
      
    
      

exports.checkedInSpot = functions.firestore
      .document('posts/{postId}/verifiers/{userId}')
      .onWrite(async (change, context) => {

        let verifierId = context.params.userId;
        let postId = context.params.postId;
        let postOwnerId = ''
        

        console.log(verifierId, postId, postOwnerId);

        var db = admin.firestore();

        return db.collection('posts').doc(postId)
                  .get()
                  .then(snapshot => {
                    
                    let data = snapshot.data();
                    postOwnerId = data.owner_id;
                    let spotName = data.spot_name;

                return db.collection('users').doc(postOwnerId)
                        .get()
                        .then(snapshot => {
                          let ownerData = snapshot.data();
                          let fcmToken = ownerData.fcmToken;


                          return db.collection('users').doc(verifierId)
                                    .get()
                                    .then(snapshot => {
                                      let verifierData = snapshot.data()
                                      let username = verifierData.displayName
                                      let imageUrl = verifierData.profileImageUrl
                                      let reputation = String(verifierData.streetCred) 
                                      let bio = verifierData.bio

                                      var payload = {
                                      notification: {
                                        title: "You've earned 1 StreetCred",
                                        body: username + ' has verified ' + spotName
                                      },
                                      data: {
                                        userid: verifierId,
                                        profileUrl: imageUrl,
                                        userDisplayName: username,
                                        streetCred: reputation,
                                        biography: bio
                                      }
                                    }

                                    admin.messaging().sendToDevice(fcmToken, payload)
                                          .then(response => {
                                            console.log('Successfully sent push notifications', response)
                                          })
                                          .catch(error => {
                                            console.log('Failed to send push notifications', error)
                                          })

                                    })
                                    .catch(error => {
                                      console.log('Error sending push notification', error)
                                    })
                        })
                        .catch(error => {
                          console.log('Error accessing verifiers branch', error)
                        })
                          })

                  .catch(error => {
                    console.log('Error accessing post branch', error)
                  })
      })



exports.savedSecretSpot = functions.firestore
      .document('posts/{postId}/savedBy/{userId}')
      .onWrite(async (change, context) => {
        
        let followerId = context.params.userId;
        let postId = context.params.postId
        var ownerId = ''
     
        var db = admin.firestore();

       return db.collection('posts').doc(postId)
                .get()
                .then(snapshot => {

                  let data = snapshot.data()
                  ownerId = data.owner_id
                  let spotName = data.spot_name
                  console.log(followerId)
                  console.log(ownerId)

                  return db.collection('users').doc(ownerId)
                          .get()
                          .then(snapshot => {
                            let ownerData = snapshot.data()
                            let fcmToken = ownerData.fcmToken

                            return db.collection('users').doc(followerId)
                                    .get()
                                    .then(snapshot => {

                                      let followerData = snapshot.data()
                                      let username = followerData.displayName
                                      let imageUrl = followerData.profileImageUrl
                                      let reputation = String(followerData.streetCred) 
                                      let bio = followerData.bio

                                      var payload = {
                                        notification: {
                                          title: "You've earned 1 StreetCred",
                                          body: username + ' has saved ' + spotName
                                        },
                                        data: {
                                          userid: followerId,
                                          profileUrl: imageUrl,
                                          userDisplayName: username,
                                          streetCred: reputation,
                                          biography: bio
                                        }
                                      }

                                      admin.messaging().sendToDevice(fcmToken, payload)
                                          .then(response => {
                                            console.log("Successfully sent push notification")
                                          })
                                          .catch(error => {
                                            console.log("Failed to send push notification", error)
                                          });

                                    })
                                    .catch(error => {
                                      console.log(error)
                                    })

                          })
                          .catch(error => {
                            console.log('Error accessing user branch from Firestore' + error)
                          })


        })
        .catch(error => {
          console.log('Error accessing data from Firestore branch' + error)
        })

        
      })
