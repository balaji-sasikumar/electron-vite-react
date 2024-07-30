import { Card, CardContent, Typography } from "@mui/material";

function NoContentsComponent() {
  return (
    <Card variant="outlined" className="my-4 flex items-center justify-center">
      <CardContent>
        <Typography
          variant="h5"
          component="h2"
          color="textSecondary"
          gutterBottom
        >
          No files or folders found in this directory.
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Please add some files or folders.
        </Typography>
      </CardContent>
    </Card>
  );
}

export default NoContentsComponent;
