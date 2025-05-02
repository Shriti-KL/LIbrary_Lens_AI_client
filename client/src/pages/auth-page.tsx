import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Redirect } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = loginSchema.extend({
  isLibrarian: z.boolean().default(true),
});

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { user, loginMutation, registerMutation } = useAuth();
  const { t } = useLanguage();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      isLibrarian: true,
    },
  });

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(data);
  };

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="flex w-full">
        {/* Form Column */}
        <div className="flex flex-col justify-center w-full max-w-md p-8 sm:p-12 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">{t('appName')}</h1>
            <p className="text-muted-foreground">
              {t('authRequired')}
            </p>
          </div>

          <Tabs 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as "login" | "register")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('login')}</TabsTrigger>
              <TabsTrigger value="register">{t('register')}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-4">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('username')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('username').toLowerCase()} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('password')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder={t('password').toLowerCase()} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                        {t('loading')}
                      </>
                    ) : (
                      t('signIn')
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 mt-4">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('username')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('username').toLowerCase()} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('password')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder={t('password').toLowerCase()} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="isLibrarian"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t('librarian')}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                        Creating Account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Hero Column */}
        <div className="hidden lg:block w-full bg-gradient-to-br from-primary/20 to-primary/5 p-8">
          <div className="h-full flex flex-col justify-center items-center text-center space-y-8">
            <div className="space-y-3">
              <h2 className="text-4xl font-bold tracking-tight">
                Library Management<br />Powered by AI
              </h2>
              <p className="text-muted-foreground max-w-md">
                An AI-powered application to streamline book cataloging and analysis for librarians.
                Simplify your library management workflow with advanced technologies.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
              <div className="p-4 bg-card rounded-lg shadow-sm">
                <h3 className="font-semibold text-lg mb-2">AI Book Analysis</h3>
                <p className="text-sm text-muted-foreground">Automatically analyze and categorize books from cover images or details</p>
              </div>
              
              <div className="p-4 bg-card rounded-lg shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Catalog Generation</h3>
                <p className="text-sm text-muted-foreground">Generate professional catalog entries using AI</p>
              </div>
              
              <div className="p-4 bg-card rounded-lg shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Book Archives</h3>
                <p className="text-sm text-muted-foreground">Search and manage your growing book collection</p>
              </div>
              
              <div className="p-4 bg-card rounded-lg shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Batch Processing</h3>
                <p className="text-sm text-muted-foreground">Process multiple books at once for efficiency</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}