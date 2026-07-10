// Custom scheme used to stream local clip/track files into <video>/<audio> elements
// without disabling webSecurity or loading file:// directly (which the renderer's CSP blocks).
export const MEDIA_PROTOCOL = 'rushcut-media'
