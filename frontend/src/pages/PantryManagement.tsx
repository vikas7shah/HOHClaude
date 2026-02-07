import { Package, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

export function PantryManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pantry Management</h1>
        <p className="text-muted-foreground">Track what's in your pantry and fridge</p>
      </div>

      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            We're working on pantry management features that will help you:
          </p>
          <ul className="text-sm text-left space-y-2 max-w-xs mx-auto">
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Track expiration dates and get reminders</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Keep inventory of pantry staples</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Get meal suggestions based on what you have</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Reduce food waste with smart tracking</span>
            </li>
          </ul>
          <div className="pt-4">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Stay tuned!
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
