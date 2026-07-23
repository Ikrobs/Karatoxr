import { QRCodeSVG } from 'qrcode.react';

export function QrCard() {
  const singUrl = `${window.location.origin}/sing`;

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-xl">
      <QRCodeSVG value={singUrl} size={180} />
      <p className="text-black/70 text-xs font-medium text-center max-w-[180px]">
        Aponte a câmera do celular para entrar
      </p>
    </div>
  );
}
