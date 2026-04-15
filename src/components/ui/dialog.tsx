"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft, XIcon } from "lucide-react"
import { useDialogStackEntry } from "@/lib/dialog-stack"

function Dialog({ open, onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  useDialogStackEntry(open, onOpenChange as ((o: boolean) => void) | undefined)
  return <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={onOpenChange} {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// DialogContent는 더 이상 back 버튼을 자동 렌더하지 않음.
// 대신 DialogHeader가 back 버튼을 제목 왼쪽에 인라인으로 렌더 (아래 정의 참조).
// onBack prop이 제공되면 커스텀 동작, 아니면 단순히 다이얼로그 닫기.
const BackButtonContext = React.createContext<{
  onBack?: () => void
  show: boolean
}>({ show: true })

function DialogContent({
  className,
  children,
  showCloseButton = false,
  showBackButton = true,
  onBack,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  showBackButton?: boolean
  onBack?: () => void
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        <BackButtonContext.Provider value={{ onBack, show: showBackButton }}>
          {children}
        </BackButtonContext.Provider>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  const { onBack, show } = React.useContext(BackButtonContext)
  if (!show) {
    return (
      <div
        data-slot="dialog-header"
        className={cn("flex flex-col gap-1", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
  const backButton = onBack ? (
    <button
      type="button"
      aria-label="뒤로"
      onClick={onBack}
      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 -ml-1.5"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : (
    <DialogPrimitive.Close
      data-slot="dialog-back"
      render={
        <button
          type="button"
          aria-label="뒤로"
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 -ml-1.5"
        />
      }
    >
      <ArrowLeft className="h-4 w-4" />
    </DialogPrimitive.Close>
  )
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {backButton}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
