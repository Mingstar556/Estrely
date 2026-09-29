const isHttp = window.location.protocol.startsWith('http');
const serverBase = isHttp ? window.location.origin : 'http://localhost:5000';

const CONFIG = {
    API_URL: `${serverBase}/api`,
    WS_URL: serverBase,
    MAX_MESSAGE_LENGTH: 10000,
    APP_NAME: 'Estrely',
    APP_VERSION: '1.0.0'
};
