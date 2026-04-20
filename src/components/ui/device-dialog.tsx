"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DraggableSheet from "@/components/ui/draggable-sheet";
import { useMediaQuery } from "@/lib/use-media-query";

// 모바일(<768px) = 바텀시트(드래그 닫기) / 데스크탑(>=768px) = 중앙 Dialog.
// plan-task-sheet · plan-transport-picker 에 반복되던 device-branch 를
// 한 곳에서 관리. 소비자는 DeviceDialog 만 쓰면 자동으로 적절한 모달이 선택됨.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 데스크탑 Dialog 의 max-width 클래스. 기본 "max-w-lg" */
  desktopMaxWidth?: string;
  /** 바텀시트 높이 (모바일) */
  mobileMaxHeight?: string;
  /** 내부 스크롤 래퍼 여부 */
  scrollable?: boolean;
  children: React.ReactNode;
}

export default function DeviceDialog({
  open,
  onOpenChange,
  title,
  desktopMaxWidth = "max-w-lg",
  mobileMaxHeight = "90dvh",
  scrollable = true,
  children,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={desktopMaxWidth}>
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          {scrollable ? (
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
              {children}
            </div>
          ) : (
            children
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <DraggableSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      maxHeight={mobileMaxHeight}
      scrollable={scrollable}
    >
      {children}
    </DraggableSheet>
  );
}
