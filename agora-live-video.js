import './style.css'
// import agoraLogo from '/agora-logo.svg'
import AgoraRTC, { IAgoraRTC } from 'agora-rtc-sdk-ng'


const appid = import.meta.env.VITE_AGORA_APP_ID
const cameraVideoPreset = '360p_7'          // 480 x 360p - 15fps @ 320 Kps
const audioConfigPreset = 'music_standard'  // 48kHz mono @ 40 Kbps
const screenShareVideoPreset = '1080_3'     // 1920 x 1080 - 30fps @ 3150 Kps

const joinform = getById('join-channel-form')
const leaveChannelBtn = getById('leaveBtn')
const micToggleBtn = getById('mic-toggle')
const videoToggleBtn = getById('video-toggle')

// helper function to quickly get dom elements
function getById(divID) {
  return document.getElementById(divID)
}

function addClick(element, clickEvent) {
  element.addEventListener('click', clickEvent)
}

// Create the Agora Client
const client = AgoraRTC.createClient({ 
  codec: 'vp9',
  mode: 'live',
  role: 'host'
})

const localTracks = {
  camera: {
    audio: null,
    video: null
  },
  screen: {
    video: null   
  }
}

const localDevives = {
  mics: [],
  cameras: [],
  output: []
}

let screenshareClient               // Create Screen Share client as needed
let isScreenShareActive = false     // Screen Share flag
const remoteUsers = { }           // Container for the remote streams
let mainStreamUid = null                      // Reference for video in the full screen view

AgoraRTC.enableLogUpload()          // Auto upload logs to Agora

// TODO: Add support for audience and url-params

async function initDevices() {
  if (!localTracks.camera.audio || !localTracks.camera.video) {
    [ localTracks.camera.audio, localTracks.camera.video ] = await AgoraRTC.createMicrophoneAndCameraTracks({ audioConfig: audioConfigPreset, videoConfig: cameraVideoPreset })
  }
  localDevives.mics = await AgoraRTC.getMicrophones()         // Get the Mic Devices
  localDevives.cameras = await AgoraRTC.getCameras()          // Get the Camera Devices
  localDevives.output = await AgoraRTC.getPlaybackDevices()   // Get the Output Devices (speakers, headphones)
  
  // TODO: append local devices to drop downs for user to switch devices

  localTracks.camera.video.play('local-video')    // Play the local video track in the local-video div
}

async function joinChannel(channelName){

  return 
}

// when the user submits the join form
joinform.addEventListener('submit', async function(e){
  e.preventDefault()
  const channelName = getById('form-channel-name').value.trim()
  if (!channelName || channelName === '') {
    return
  }

  toggleModalDisplay()
  
  // TODO: hide overlay with inputs
  await initDevices()               // Initialize the devices and create Tracks
  
  // Add listeners for Agora Client Events
  client.on('user-joined', handleRemotUserJoined)
  client.on('user-left', handleRemotUserLeft)
  client.on('user-published', handleRemotUserPublished)
  client.on('user-unpublished', handleRemotUserUnpublished)


  // Join the channel and publish out streams
  const token = null                              // Token security is not enabled
  const uid = null                                // Pass null to have Agora set UID dynamically
  await client.join(appid, channelName, token, uid)
  await client.publish([localTracks.camera.audio, localTracks.camera.video])
})

// New remote users joins the channel
const handleRemotUserJoined = async (user) => {
  const uid = user.uid
  remoteUsers[uid] = user         // add the user to the remote users
  await createRemoteUserDiv(uid)  // create remote user div
}

// Remote user leaves the channel
const handleRemotUserLeft = async (user, reason) => {
  const uid = user.uid
  delete remoteUsers[uid]
  // Remove user from remote users container
  await removeRemoteUserDiv(uid)
  console.log(`User ${uid} left the channel with reason:${reason}`)
}

// Remote user publishes a track (audio or video)
const handleRemotUserPublished = async (user, mediaType) => {
  const uid = user.uid
  await client.subscribe(user, mediaType)
  remoteUsers[uid] = user                             // update remote user reference
  if (mediaType === 'video') { 
    user.videoTrack.play(`remote-user-${uid}-video`) 
    // if (mainIsEmpty) {
    //   mainStreamUid = uid
    //   user.videoTrack.play('full-screen-video') // play video on main user div
    //   // await removeRemoteUserDiv(uid)
    // } else {
    //    // play video on remote user div
    //    user.videoTrack.play(`remote-user-${uid}-video`) 
    // }           
  } else if (mediaType === 'audio') {
    user.audioTrack.play()
  }
}

// Remote user unpublishes a track (audio or video)
const handleRemotUserUnpublished = async (user, mediaType) => {
  const uid = user.uid
  console.log(`User ${uid} unpublished their ${mediaType}`)
  if (mediaType === 'video') {
    // Check if its the full screen user
    if (uid === mainStreamUid) {
      if(Object.keys(remoteUsers).length > 1) {
        // Find a user and switch them to the full-screen
        const randomUid = getRandomRemoteUserUid()
        await setNewMainVideo(randomUid)
      } else{
        getById('full-screen-video').replaceChildren() // Remove all children of the main div
      }
    } else {
      const remoteUserPlayer = getById(`remote-user-${uid}-video`)
      if (remoteUserPlayer){
        remoteUserPlayer.replaceChildren() // Remove all children of the div
      } 
    }
    // TODO: show no video icon
  } else if (mediaType === 'audio') {
    // TODO: show no mic icon
  }
}

// create the remote user container and video player div
const createRemoteUserDiv = async (uid) => {
  console.log('add remote user div')
  const containerDiv = document.createElement('div')
  containerDiv.id = `remote-user-${uid}-container`
  const remoteUserDiv = document.createElement('div')
  remoteUserDiv.id = `remote-user-${uid}-video`
  remoteUserDiv.classList.add('remote-video')
  containerDiv.appendChild(remoteUserDiv)
  // Add remote user to remote video container
  getById('remote-video-container').appendChild(containerDiv)

  // Double click to swap container with main div
  // containerDiv.addEventListener('dblclick', async (e) => {
  //   await setNewMainVideo(uid)
  // })
}

const removeRemoteUserDiv = async (uid) => {
  const containerDiv = getById(`remote-user-${uid}-container`)
  if (containerDiv) {
    containerDiv.parentNode.removeChild(containerDiv)
  }
}

const mainIsEmpty = () => {
  return getById('full-screen-video').childNodes.length === 0
}

const setNewMainVideo = async (newMainUid) => {
  getById('full-screen-video').replaceChildren()  // clear the main div
  await createRemoteUserDiv(mainStreamUid)
  remoteUsers[mainStreamUid].videoTrack.play(`remote-user-${mainStreamUid}-video`)
  await removeRemoteUserDiv(newMainUid)
  remoteUsers[newMainUid].videoTrack.play('full-screen-video')
  mainStreamUid = newMainUid
}

const getRandomRemoteUserUid = () => {
  const allUids = Object.keys(remoteUsers)
  if (allUids.length === 0) return undefined   // TODO: handle error-case
  // return a random uid
  return allUids[Math.floor(Math.random() * allUids.length)]
}

const toggleModalDisplay = () => {
  console.log('toggle-overlay')
  const modal = getById('overlay')
  if (modal.classList.contains('show')) {
    modal.classList.remove('show')
  } else {
    modal.style.display = 'block'
    requestAnimationFrame(() => {
      modal.classList.add('show')
    })
  }
}

// Listen for page loaded event
document.addEventListener('DOMContentLoaded', () => {
  console.log('page-loaded')
  toggleModalDisplay()
})

