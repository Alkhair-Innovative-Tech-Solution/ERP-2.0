// // import React, { useEffect, useRef } from 'react';
// // import QRCode from 'qrcode';

// // const QRCodeComponent = () => {
// //   const canvasRef = useRef<HTMLCanvasElement | null>(null);

// //   useEffect(() => {
// //     if (canvasRef.current) {
// //       QRCode.toCanvas(canvasRef.current, 'https://your-url-here.com', { width: 200 }, (error: any) => {
// //         if (error) console.error(error);
// //       });
// //     }
// //   }, []);

// //   return (
// //     <div>
// //       <h1>QR Code</h1>
// //       <canvas ref={canvasRef}></canvas>
// //     </div>
// //   );
// // };

// // export default QRCodeComponent;
// // Scan.tsx
// 'use client'
// import React from 'react'
// // Instead of import QRCode from 'qrcode.react'
// const QRCode = require('qrcode.react')

// const Scan = () => {
//   const locationUrl = 'https://maps.app.goo.gl/N7qseN8YnHjifU1f7'

//   return (
//     <div className="flex flex-col items-center gap-4 p-4">
//       <h2 className="text-xl font-bold">Scan to Find Our Location</h2>
//       <QRCode value={locationUrl} size={200} />
//       <a
//         href={locationUrl}
//         target="_blank"
//         rel="noopener noreferrer"
//         className="text-blue-600 underline"
//       >
//         Or click here to open location
//       </a>
//     </div>
//   )
// }

// export default Scan
