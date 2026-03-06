'use client';

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
}

interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const AlertDialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} });

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogContent({ children, className }: AlertDialogContentProps) {
  const { open, onOpenChange } = React.useContext(AlertDialogContext);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "relative z-50 w-full max-w-md rounded-xl bg-white p-6 shadow-lg animate-in fade-in-0 zoom-in-95",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ children, className }: AlertDialogHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}>
      {children}
    </div>
  );
}

export function AlertDialogFooter({ children, className }: AlertDialogFooterProps) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)}>
      {children}
    </div>
  );
}

export function AlertDialogTitle({ children, className }: AlertDialogTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold", className)}>
      {children}
    </h2>
  );
}

export function AlertDialogDescription({ children, className }: AlertDialogDescriptionProps) {
  return (
    <p className={cn("text-sm text-gray-500", className)}>
      {children}
    </p>
  );
}

export function AlertDialogAction({ children, variant = 'default', className, ...props }: AlertDialogActionProps) {
  return (
    <Button variant={variant} className={cn("mt-2 sm:mt-0", className)} {...props}>
      {children}
    </Button>
  );
}

export function AlertDialogCancel({ children, className, ...props }: AlertDialogCancelProps) {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  
  return (
    <Button 
      variant="outline" 
      className={cn("mt-2 sm:mt-0", className)} 
      onClick={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </Button>
  );
}
