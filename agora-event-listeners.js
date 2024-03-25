
import IAgoraRTCClient from './agora-rtc-sdk-ng'

const AddAgoraEventListeners = (client) => {

  client.on('user-published', handleRemotUserPublished)

  const handleRemotUserPublished = (user, mediaType) => {

  }

  async function subscribe (user, mediaType) {
    const uid = user.uid
    await client.subscribe(user, mediaType)
    
  }
  
}
export default AddAgoraEventListeners
