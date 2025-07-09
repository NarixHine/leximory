import {
    Card,
    CardHeader,
    CardBody,
  } from '@heroui/card'
  
  export default function SignUpSuccessPage() {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <h1 className="text-2xl">Thank you for signing up!</h1>
                <p>Check your email to confirm</p>
              </CardHeader>
              <CardBody>
                <p className="text-sm">
                  You&apos;ve successfully signed up. Please check your email to confirm your account
                  before signing in.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    )
  }