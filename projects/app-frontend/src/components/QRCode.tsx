import QRCodeLib from 'qrcode'
import { useEffect, useRef } from 'react'

interface QRCodeProps {
  value: string
  size?: number
  title?: string
  className?: string
}

export function QRCode({ value, size = 200, title, className = '' }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCodeLib.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).catch(() => {
        // QR code generation failed silently
      })
    }
  }, [value, size])

  if (!value) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`} style={{ width: size, height: size }}>
        <span className="text-gray-500 text-sm">No data</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {title && <h4 className="text-sm font-medium mb-2 text-center">{title}</h4>}
      <canvas ref={canvasRef} className="border border-gray-300 rounded" />
      <p className="text-xs text-gray-600 mt-2 break-all max-w-full text-center">{value}</p>
    </div>
  )
}

interface QRModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  value: string
}

export function QRModal({ isOpen, onClose, title, value }: QRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && value && isOpen) {
      QRCodeLib.toCanvas(canvasRef.current, value, {
        width: 250,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).catch(() => {
        // QR code generation failed silently
      })
    }
  }, [value, isOpen])

  const downloadQR = () => {
    if (canvasRef.current) {
      const link = document.createElement('a')
      link.download = `QR_${title.replace(/\s+/g, '_')}_${Date.now()}.png`
      link.href = canvasRef.current.toDataURL()
      link.click()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl font-bold">
            ×
          </button>
        </div>
        <div className="flex flex-col items-center">
          <canvas ref={canvasRef} className="border border-gray-300 rounded mb-2" />
          <p className="text-xs text-gray-600 mt-2 break-all max-w-full text-center">{value}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
          >
            📋 Copy
          </button>
          <button onClick={downloadQR} className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm">
            💾 Download
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
