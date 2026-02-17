"use client"

import { useState, useEffect } from "react"

interface User {
  id: number
  username: string
  role: string
  page_access: string[]
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      try {
        const userStr = localStorage.getItem("user")
        const authStatus = localStorage.getItem("isAuthenticated") === "true"

        if (authStatus && userStr) {
          const userData = JSON.parse(userStr)
          setUser(userData)
          setIsAuthenticated(true)
        } else {
          setUser(null)
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("Auth check failed:", error)
        setUser(null)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
    
    // Listen for storage events to sync across tabs
    window.addEventListener("storage", checkAuth)
    return () => window.removeEventListener("storage", checkAuth)
  }, [])

  const isReadOnly = user?.role === "pc"
  const isAdmin = user?.role === "admin"

  return {
    user,
    isAuthenticated,
    isLoading,
    isReadOnly,
    isAdmin,
    role: user?.role
  }
}
