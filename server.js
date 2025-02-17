// api/index.js
export const config = {
    runtime: 'edge',
    regions: ['iad1']
  }
  
  const ELEVENLABS_ENDPOINT = `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`
  
  async function generateTwiMLResponse(audioContent) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play>data:audio/mpeg;base64,${audioContent}</Play>
      </Response>`;
  }
  
  export default async function handler(request) {
    try {
      // Handle Twilio voice webhook
      if (request.method === 'POST') {
        const formData = await request.formData();
        const speechResult = formData.get('SpeechResult')?.trim() || "Hello";
  
        console.log('Received speech input:', speechResult);
  
        // Initial greeting
        if (speechResult.toLowerCase().includes('hello')) {
          const twiML = `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
              <Say>Hello! I can help you with weather and stock information.</Say>
            </Response>`;
          return new Response(twiML, {
            headers: { 'Content-Type': 'text/xml' }
          });
        }
  
        // Process the request
        let responseText = await processInput(speechResult);
        responseText = responseText.substring(0, 100);
  
        // Generate speech
        const audioData = await generateSpeech(responseText);
        const twiML = await generateTwiMLResponse(audioData);
  
        return new Response(twiML, {
          headers: { 'Content-Type': 'text/xml' }
        });
      }
  
      // Default landing page
      return new Response(`
        <html>
          <body>
            <h1>Voice Assistant</h1>
            <p>This is a Twilio voice webhook endpoint. Call your Twilio number to interact.</p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
  
    } catch (error) {
      console.error('Error:', error);
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Sorry, there was an error processing your request.</Say>
        </Response>`;
      return new Response(errorTwiML, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
  }
  
  async function generateSpeech(text) {
    const response = await fetch(ELEVENLABS_ENDPOINT, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
  
    const arrayBuffer = await response.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  }
  
  async function processInput(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('weather')) {
      return await getWeather(input);
    }
    if (lowerInput.includes('stock') || lowerInput.includes('price')) {
      return await getStock(input);
    }
    
    return "I can help with weather and stocks. Please ask about either.";
  }
  
  async function getWeather(query) {
    const city = query.match(/weather in ([a-zA-Z\s]+)/i)?.[1]?.trim() || "New York";
    
    const response = await fetch(
      `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${encodeURIComponent(city)}`
    );
    
    const data = await response.json();
    
    if (!data?.current) {
      return `Weather unavailable for ${city}`;
    }
  
    return `Temperature in ${city}: ${data.current.temperature}°C`;
  }
  
  async function getStock(query) {
    const symbol = query.match(/price of ([A-Za-z]+)/i)?.[1]?.toUpperCase().trim() || "AAPL";
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    );
    
    const data = await response.json();
    const price = data["Global Quote"]?.["05. price"];
    
    if (!price) {
      return `Stock price unavailable for ${symbol}`;
    }
  
    return `${symbol} stock price: $${parseFloat(price).toFixed(2)}`;
  }
