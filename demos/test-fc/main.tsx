import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  useEffect(() => {
    return () => console.log('Unmount parent');
  });
  return <Child />;
}

function Child() {
  useEffect(() => {
    return () => console.log('Unmount child');
  });
  return 'Child';
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
