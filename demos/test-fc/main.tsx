import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);
  window.setNum = setNum;
  return (
    <div>
      <span>{num}</span>
    </div>
  );
}

function Child() {
  return <span>Child </span>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
