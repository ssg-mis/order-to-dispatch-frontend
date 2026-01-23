"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { userApi } from "@/lib/api-service"
import { Loader2, PackageCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Validation Error",
        description: "Please enter both username and password",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await userApi.login(credentials)
      
      if (response.success && response.data) {
        // Store user data in localStorage
        localStorage.setItem("user", JSON.stringify(response.data))
        localStorage.setItem("isAuthenticated", "true")
        
        toast({
          title: "Login Successful",
          description: `Welcome back, ${response.data.username}!`,
        })
        
        // Redirect to dashboard
        router.push("/")
      } else {
        toast({
          title: "Login Failed",
          description: response.message || "Invalid credentials",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An error occurred during login",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <PackageCheck className="h-8 w-8" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tight">Welcome Back</CardTitle>
            <CardDescription className="text-base mt-2">
              Sign in to Order Management System
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Contact your administrator for access credentials</p>
          </div>
        </CardContent>
      </Card>
      <div className="fixed bottom-4 text-center w-full">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Powered by Botivate
        </p>
      </div>
    </div>
  )
}
