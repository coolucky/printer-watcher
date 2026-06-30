import React, { useEffect } from 'react';

const SimpleSettingsPanel = () => {
  useEffect(() => {
    console.log('SimpleSettingsPanel component mounted');
    console.log('Testing API connection...');
    
    // Test API connection
    fetch('http://127.0.0.1:3001/api/settings')
      .then(response => {
        console.log('API response status:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('API response data:', data);
      })
      .catch(error => {
        console.error('API error:', error);
      });
  }, []);

  return (
    <div>
      <h2>Simple Settings Panel</h2>
      <p>This is a simple settings panel for testing.</p>
      <p>Check the browser console for API response.</p>
    </div>
  );
};

export default SimpleSettingsPanel;