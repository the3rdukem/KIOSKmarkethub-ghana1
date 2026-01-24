"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const thumbClassName = "block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-md transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:border-primary hover:bg-primary/10 hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  const thumbCount = Array.isArray(value) ? value.length : Array.isArray(defaultValue) ? defaultValue.length : 1;
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center group",
        className
      )}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20 cursor-pointer transition-all duration-150 group-hover:h-2.5">
        <SliderPrimitive.Range className="absolute h-full bg-primary transition-all duration-75" />
      </SliderPrimitive.Track>
      {thumbCount === 2 ? (
        <>
          <SliderPrimitive.Thumb className={thumbClassName} />
          <SliderPrimitive.Thumb className={thumbClassName} />
        </>
      ) : thumbCount === 3 ? (
        <>
          <SliderPrimitive.Thumb className={thumbClassName} />
          <SliderPrimitive.Thumb className={thumbClassName} />
          <SliderPrimitive.Thumb className={thumbClassName} />
        </>
      ) : (
        <SliderPrimitive.Thumb className={thumbClassName} />
      )}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
