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
        // Store user data and authenticated status
        const { token, ...userData } = response.data
        localStorage.setItem("user", JSON.stringify(userData))
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="flex-1 flex items-center justify-center w-full my-auto">
        <Card className="w-full max-w-sm shadow-xl border-none">
          <CardHeader className="space-y-3 text-center pb-4 pt-6">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                <PackageCheck className="h-6 w-6" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-black tracking-tight">Welcome Back</CardTitle>
              <CardDescription className="text-xs mt-1">
                Sign in to Order Management System
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="username" className="text-xs font-bold">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  disabled={isLoading}
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs font-bold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  disabled={isLoading}
                  className="h-10 text-sm"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-10 text-sm font-semibold mt-4 shadow-sm"
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
            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>Contact your administrator for access credentials</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 text-center pb-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Powered by Botivate
        </p>
      </div>
    </div>
  )
}
