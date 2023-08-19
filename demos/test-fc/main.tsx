import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);
  window.setNum = setNum;
  return num === 3 ? <Child /> : <div><span>{num}</span></div>;
}

function Child() {
  return <span>Child </span>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
