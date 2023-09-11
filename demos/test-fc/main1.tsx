import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);
  // useEffect(() => {
  //   return () => console.log('Unmount parent');
  // });
  // return <Child />;
  return (
    <ul onClick={() => setNum(50)}>
      {new Array(num).fill(0).map((_, i) => {
        return <Child key={i}>{i}</Child>;
      })}
    </ul>
  );
}

function Child({ children }) {
  // useEffect(() => {
  //   return () => console.log('Unmount child');
  // });

  const now = performance.now();
  while (performance.now() - now < 4) {}
  return <li>{children}</li>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
