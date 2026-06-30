import React, { useEffect, useState } from 'react';

const TestComponent = () => {
  const [apiStatus, setApiStatus] = useState('Loading...');
  const [apiData, setApiData] = useState(null);

  useEffect(() => {
    console.log('TestComponent mounted');
    console.log('Testing API connection...');
    
    // Test API connection
    fetch('/api/settings')
      .then(response => {
        console.log('API response status:', response.status);
        setApiStatus(`API response status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        console.log('API response data:', data);
        setApiData(JSON.stringify(data, null, 2));
      })
      .catch(err => {
        console.error('API connection error:', err);
        setApiStatus(`API connection error: ${err.message}`);
      });
  }, []);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px 0' }}>
      <h1>Test Component</h1>
      <p>API Status: {apiStatus}</p>
      {apiData && (
        <div style={{ marginTop: '20px' }}>
          <h2>API Response Data:</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{apiData}</pre>
        </div>
      )}
    </div>
  );
};

export default TestComponent;