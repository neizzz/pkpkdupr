import React, { useState } from 'react';
import { Tabs, Modal, useOverlayState } from '@heroui/react';
import { IoQrCodeSharp } from 'react-icons/io5';
import QrCode from 'react-qr-code';
import Match from '@/pages/Match';
import Player from '@/pages/Player';
import Me from '@/pages/Me';

const BottomNav: React.FC = () => {
    const [selected, setSelected] = useState('match');
    const qrState = useOverlayState();

    const renderPage = () => {
        switch (selected) {
            case 'match': return <Match />;
            case 'player': return <Player />;
            case 'me': return <Me />;
            default: return <Match />;
         }
     };

    return (<Tabs.Root selectedKey={selected} onSelectionChange={(key) => setSelected(String(key))}>
                  <div className="flex flex-col h-screen max-w-[430px] mx-auto">
                      {/* 페이지 내용 영역 */}
<div className="flex-1 overflow-y-auto pb-20">{
                        renderPage()
                     }</div>

                      {/* 하단 네비게이션 */}
                      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-200 z-50">
                          <div className="flex items-end justify-around px-2 pb-2 pt-1">
                              {/* 좌측 탭 */}
                                <div className="flex gap-6">
                                    <Tabs.Tab key="match" className={`flex flex-col items-center gap-0.5 pb-1 ${selected === 'match' ? 'text-blue-600' : 'text-gray-500'}`}>
                                        <span className="text-xs font-medium">Match</span>
                                    </Tabs.Tab>
                                </div>

                              {/* 중앙 QR 버튼 */}
<div className="flex flex-col items-center -mt-6">
                                  <button
                                    onClick={qrState.open}
                                    className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                                  >
                                      <IoQrCodeSharp size={28} color="white" />
                                  </button>
                              </div>

                              {/* 우측 탭 */}
                                 <div className="flex gap-6">
                                     <Tabs.Tab key="player" className={`flex flex-col items-center gap-0.5 pb-1 ${selected === 'player' ? 'text-blue-600' : 'text-gray-500'}`}>
                                         <span className="text-xs font-medium">Player</span>
                                     </Tabs.Tab>
                                     <Tabs.Tab key="me" className={`flex flex-col items-center gap-0.5 pb-1 ${selected === 'me' ? 'text-blue-600' : 'text-gray-500'}`}>
                                         <span className="text-xs font-medium">Me</span>
                                     </Tabs.Tab>
                                 </div>
                          </div>
                      </div>

                      {/* QR Code Modal */}
                        <Modal.Root state={qrState}>
                              <Modal.Container placement="center" size="sm">
                                  <Modal.Body className="rounded-2xl p-6 flex flex-col items-center gap-4">
                                      <Modal.CloseTrigger className="absolute top-3 right-3" />
                                      <p className="text-sm font-semibold text-gray-800">My Player ID</p>
                                      <QrCode value="player-001" size={180} bgColor="#ffffff" fgColor="#1e40af" />
                                  </Modal.Body>
                              </Modal.Container>
                          </Modal.Root>
                  </div>
              </Tabs.Root>);
};

export default BottomNav;
