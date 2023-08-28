import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);
  // window.setNum = setNum;
  // return num === 3 ? <Child /> : <div><span>{num}</span></div>;

  const list =
    num % 2 === 0
      ? [<li key={1}>1</li>, <li key={2}>2</li>, <li key={3}>3</li>]
      : [<li key={3}>3</li>, <li key={2}>2</li>, <li key={1}>1</li>];
  return (
    <ul onClickCapture={() => setNum(num + 1)}>
      <li>4</li>
      <li>5</li>
      {list}
    </ul>
  );
}

function Child() {
  return <span>Child </span>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
